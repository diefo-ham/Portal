/**
 * Browser side of scripts/pdf-render-check.mjs. Renders question and explanation
 * images with the production code path and compares them with the Python tool's
 * images for the same questions.
 */
import { openExport, encodeWebp } from "/src/importing/pdf/pdfjsAdapter.ts";
import { planCrops } from "/src/importing/pdf/crops.ts";
import { buildPanels } from "/src/importing/pdf/panels.ts";
import { trimWhite } from "/src/importing/pdf/raster.ts";

const decode = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
};

/** Mean absolute channel difference and share of clearly differing pixels over the overlap, with image b shifted down by dy rows. */
function compareAt(a, b, dy, stride = 1) {
  const top = Math.max(0, dy);
  const height = Math.min(a.height, b.height + dy) - top;
  const width = Math.min(a.width, b.width);
  if (height <= 0) return { mean: 255, differing: 1, dy };
  let sum = 0;
  let differing = 0;
  for (let y = top; y < top + height; y += stride)
    for (let x = 0; x < width; x += stride) {
      const i = (y * a.width + x) * 4;
      const j = ((y - dy) * b.width + x) * 4;
      const d =
        Math.abs(a.data[i] - b.data[j]) +
        Math.abs(a.data[i + 1] - b.data[j + 1]) +
        Math.abs(a.data[i + 2] - b.data[j + 2]);
      sum += d / 3;
      if (d > 48) differing++;
    }
  const samples = Math.ceil(height / stride) * Math.ceil(width / stride);
  return { mean: sum / samples, differing: differing / samples, dy };
}

/** Compares at no shift, then searches a few rows either way so a one-pixel trim difference is not scored as a mismatch. */
function compare(a, b) {
  // Search the alignment on every fourth pixel, then score the winner in full.
  let bestDy = 0;
  let bestMean = compareAt(a, b, 0, 4).mean;
  if (bestMean > 0.5)
    for (let dy = -8; dy <= 8; dy++) {
      if (dy === 0) continue;
      const mean = compareAt(a, b, dy, 4).mean;
      if (mean < bestMean) {
        bestMean = mean;
        bestDy = dy;
      }
    }
  const best = compareAt(a, b, bestDy);
  // Edge anti-aliasing differs between renderers, so also compare 16x16 block averages;
  // a missing glyph or figure shows up as a large block difference.
  best.blockMax = blockMax(a, b, best.dy);
  return best;
}

function blockMax(a, b, dy) {
  const size = 16;
  const top = Math.max(0, dy);
  const height = Math.min(a.height, b.height + dy) - top;
  const width = Math.min(a.width, b.width);
  let worst = 0;
  for (let y0 = top; y0 + size <= top + height; y0 += size)
    for (let x0 = 0; x0 + size <= width; x0 += size) {
      let sa = 0;
      let sb = 0;
      for (let y = y0; y < y0 + size; y++)
        for (let x = x0; x < x0 + size; x++) {
          const i = (y * a.width + x) * 4;
          const j = ((y - dy) * b.width + x) * 4;
          sa += (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3;
          sb += (b.data[j] + b.data[j + 1] + b.data[j + 2]) / 3;
        }
      worst = Math.max(worst, Math.abs(sa - sb) / (size * size));
    }
  return worst;
}

window.runCheck = async ({ files, step, offset, limit }) => {
  const reference = await (await fetch("/__ref/questions.json")).json();
  const documents = new Map();
  const results = [];
  const timing = { panels: 0, ms: 0 };
  let checked = 0;
  const bySource = [...reference.questions].sort((a, b) =>
    a.sourceId.localeCompare(b.sourceId),
  );
  for (let n = offset; n < bySource.length && checked < limit; n += step) {
    const q = bySource[n];
    const provenance = q.document.provenance[0];
    const name = provenance.filename.replace(/\.pdf$/, "");
    if (files && !files.includes(name)) continue;
    checked++;
    try {
      if (!documents.has(name)) {
        const bytes = new Uint8Array(
          await (await fetch(`/__pdf/${name}.pdf`)).arrayBuffer(),
        );
        documents.set(name, await openExport(bytes));
      }
      const doc = documents.get(name);
      const record = { id: q.sourceId, pages: provenance.pages };
      const layouts = [];
      for (const page of record.pages) layouts.push(await doc.layout(page));
      const plans = planCrops(record, layouts);
      const store = new Map();
      const started = performance.now();
      const mine = await buildPanels(plans, doc.renderer, {
        encode: encodeWebp,
        put: async (key, blob) => void store.set(key, blob),
      });
      timing.ms += performance.now() - started;
      timing.panels += plans.length;
      for (const kind of ["question", "rationale"]) {
        const want = q.document[kind];
        const got = mine[kind];
        const entry = {
          id: q.sourceId,
          kind,
          panels: [got.length, want.length],
          dims: [],
          blobTypes: [...new Set([...store.values()].map((b) => b.type))],
        };
        if (got.length === want.length)
          for (let i = 0; i < got.length; i++) {
            const blob = store.get(got[i].src.slice(6));
            const ref = await (
              await fetch(`/__ref/assets/${want[i].src.slice(6)}`)
            ).blob();
            const [mineImage, refImage] = [
              await decode(blob),
              await decode(ref),
            ];
            entry.dims.push({
              mine: [got[i].width, got[i].height],
              want: [want[i].width, want[i].height],
              ...compare(mineImage, refImage),
            });
          }
        results.push(entry);
      }
    } catch (error) {
      results.push({ id: q.sourceId, error: String(error.message ?? error) });
    }
  }
  for (const doc of documents.values()) await doc.close();
  return { checked, results, timing };
};
/** Side-by-side PNG (mine left, Python right) of one question's first panel of a kind, for eyeballing. */
window.dumpPanel = async ({ id, kind, index }) => {
  const reference = await (await fetch("/__ref/questions.json")).json();
  const q = reference.questions.find((x) => x.sourceId === id);
  const provenance = q.document.provenance[0];
  const name = provenance.filename.replace(/.pdf$/, "");
  const doc = await openExport(
    new Uint8Array(await (await fetch(`/__pdf/${name}.pdf`)).arrayBuffer()),
  );
  const record = { id, pages: provenance.pages };
  const layouts = [];
  for (const page of record.pages) layouts.push(await doc.layout(page));
  const store = new Map();
  const mine = await buildPanels(planCrops(record, layouts), doc.renderer, {
    encode: encodeWebp,
    put: async (k, b) => void store.set(k, b),
  });
  const a = await decode(store.get(mine[kind][index].src.slice(6)));
  const b = await decode(
    await (
      await fetch(`/__ref/assets/${q.document[kind][index].src.slice(6)}`)
    ).blob(),
  );
  const canvas = new OffscreenCanvas(
    a.width + b.width + 20,
    Math.max(a.height, b.height),
  );
  const context = canvas.getContext("2d");
  context.fillStyle = "#c0c0ff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.putImageData(a, 0, 0);
  context.putImageData(b, a.width + 20, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  await doc.close();
  return btoa(binary);
};
/** Full pipeline on the synthetic export: index, convert text, plan crops, render, and inspect pixels. */
window.runSynthetic = async () => {
  const { indexExport } = await import("/src/importing/pdf/segment.ts");
  const { convertRecordText } = await import("/src/importing/pdf/record.ts");
  const bytes = new Uint8Array(
    await (await fetch("/__synthetic.pdf")).arrayBuffer(),
  );
  const doc = await openExport(bytes);
  const layouts = [];
  for (let n = 1; n <= doc.pageCount; n++) layouts.push(await doc.layout(n));
  const records = indexExport("synthetic.pdf", layouts);
  const store = new Map();
  const out = [];
  for (const record of records) {
    const text = convertRecordText(record);
    const plans = planCrops(
      record,
      record.pages.map((n) => layouts[n - 1]),
    );
    const panels = await buildPanels(plans, doc.renderer, {
      encode: encodeWebp,
      put: async (key, blob) => void store.set(key, blob),
    });
    const entry = {
      id: record.id,
      pages: record.pages,
      answer: text.answer,
      stem: text.stem,
      question: panels.question.map((x) => [x.width, x.height]),
      rationale: panels.rationale.map((x) => [x.width, x.height]),
    };
    const first = await decode(store.get(panels.question[0].src.slice(6)));
    let yellow = 0;
    for (let i = 0; i < first.data.length; i += 4)
      if (
        first.data[i] > 200 &&
        first.data[i + 1] > 200 &&
        first.data[i + 2] < 150
      )
        yellow++;
    entry.yellowPixels = yellow;
    let dark = 0;
    for (let y = 0; y < Math.min(20, first.height); y++) {
      const i = (y * first.width + 400) * 4;
      if (Math.max(first.data[i], first.data[i + 1], first.data[i + 2]) < 20)
        dark++;
    }
    entry.numeratorDarkRows = dark;
    entry.blobType = [...store.values()][0].type;
    // Lossless means the decoded pixels equal the rendered pixels exactly.
    const raster = trimWhite(
      await doc.renderer.render(plans[0].page, plans[0].rect),
    );
    const decoded = await decode(await encodeWebp(raster));
    entry.lossless =
      decoded.width === raster.width &&
      decoded.height === raster.height &&
      decoded.data.every((value, i) => value === raster.data[i]);
    out.push(entry);
  }
  await doc.close();
  return out;
};
/** The whole preparation (the same code the Settings page runs) on the real exports, with images discarded. */
window.runPrepare = async ({ mode }) => {
  const { prepareLibrary, EXPORT_NAMES } =
    await import("/src/importing/pdf/prepare.ts");
  const overridesResponse = await fetch("/__ref/overrides.json");
  const overrides = overridesResponse.ok
    ? await overridesResponse.json()
    : undefined;
  const files = {};
  for (const name of EXPORT_NAMES)
    files[name] = {
      name: name + ".pdf",
      size: 0,
      arrayBuffer: async () =>
        (await fetch(`/__pdf/${name}.pdf`)).arrayBuffer(),
    };
  const prepared = await prepareLibrary(
    files,
    { mode, overrides },
    {
      open: openExport,
      store: { encode: encodeWebp, put: async () => {} },
    },
  );
  return {
    report: prepared.report,
    questions: JSON.parse(prepared.questionsJson).questions,
    assets: prepared.manifest.assets.length,
  };
};
window.ready = true;
