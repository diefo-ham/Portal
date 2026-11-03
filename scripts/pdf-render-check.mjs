/**
 * Local-only check of the browser rendering path (src/importing/pdf) against the
 * Python tool's images for the person's own PDF exports.
 *
 *   node scripts/pdf-render-check.mjs --pdfs <dir> --private <dir> [--step 40] [--offset 0] [--limit 100] [--files a,b]
 *
 * Serves the PDFs and the Python library on 127.0.0.1 only for the duration of the
 * run, renders sampled questions in headless Edge, and prints a summary. Nothing
 * is written to disk and nothing leaves the machine. Never runs in CI.
 */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const argument = (name, fallback) => {
  const index = process.argv.indexOf("--" + name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const pdfs = resolve(argument("pdfs", "."));
const library = join(resolve(argument("private", ".")), "library");
const step = Number(argument("step", 40));
const offset = Number(argument("offset", 0));
const limit = Number(argument("limit", 100));
const files = argument("files")?.split(",");
const synthetic = argument("synthetic");

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 4520, strictPort: true },
  optimizeDeps: {
    entries: ["scripts/pdf-render-check.client.mjs"],
    include: ["pdfjs-dist"],
  },
  plugins: [
    {
      name: "local-private-files",
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          const path = decodeURIComponent(
            new URL(req.url, "http://x").pathname,
          );
          let target;
          if (synthetic && path === "/__synthetic.pdf")
            target = resolve(synthetic);
          else if (/^\/__pdf\/[a-z_]+\.pdf$/.test(path))
            target = join(pdfs, path.slice(7));
          else if (path === "/__ref/overrides.json")
            target = join(library, "..", "pdf-overrides.json");
          else if (path === "/__ref/questions.json")
            target = join(library, "questions.json");
          else if (/^\/__ref\/assets\/[a-f0-9]{64}\.webp$/.test(path))
            target = join(library, "assets", path.slice(14));
          if (!target) return next();
          if (!existsSync(target) || !statSync(target).isFile()) {
            res.writeHead(404).end();
            return;
          }
          createReadStream(target).pipe(res);
        });
      },
    },
  ],
});
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage();
page.on("pageerror", (error) =>
  console.log("pageerror:", error.message.slice(0, 200)),
);
page.on("response", (response) => {
  if (response.status() === 404)
    console.log("404:", response.url().slice(0, 140));
});
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    console.log("console:", message.text().slice(0, 160));
});
await page.goto("http://127.0.0.1:4520/scripts/pdf-render-check.html");
await page.waitForFunction(() => window.ready === true, null, {
  timeout: 120000,
});
if (synthetic) {
  await page.waitForFunction(() => window.ready === true, null, {
    timeout: 120000,
  });
  const results = await page.evaluate(() => window.runSynthetic());
  await browser.close();
  await server.close();
  const [choice, numeric] = results;
  const checks = [
    ["two questions found", results.length === 2],
    ["choice answer read from the key", choice?.answer?.value === "C"],
    [
      "numeric answer read from the key",
      numeric?.answer?.accepted?.join() === "12",
    ],
    ["highlight annotation not drawn", choice?.yellowPixels === 0],
    [
      "math right under the heading is not clipped",
      choice?.numeratorDarkRows >= 5,
    ],
    [
      "answer key area stays out of the question image",
      choice?.question?.[0]?.[1] < 400,
    ],
    [
      "each image is full width",
      [...(choice?.question ?? []), ...(choice?.rationale ?? [])].every(
        ([w]) => w === 1160,
      ),
    ],
    [
      "continued question has two question images",
      numeric?.question?.length === 2 && numeric?.rationale?.length === 1,
    ],
    ["images are WebP", choice?.blobType === "image/webp"],
    ["WebP encoding is lossless", results.every((r) => r.lossless === true)],
  ];
  for (const [name, ok] of checks) console.log(ok ? "PASS" : "FAIL", name);
  console.log(JSON.stringify(results));
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}
if (process.argv.includes("--prepare")) {
  await page.waitForFunction(() => window.ready === true, null, {
    timeout: 120000,
  });
  const started = Date.now();
  const outcome = await page.evaluate((o) => window.runPrepare(o), {
    mode: argument("mode", "active-only"),
  });
  await browser.close();
  await server.close();
  const { readFileSync } = await import("node:fs");
  const reference = JSON.parse(
    readFileSync(join(library, "questions.json"), "utf8"),
  );
  const want = new Map(reference.questions.map((q) => [q.sourceId, q]));
  const { comparable } = await import("./pdf-compare.mjs");
  const tally = {
    same: 0,
    answer: 0,
    origin: 0,
    choices: 0,
    warnings: 0,
    status: 0,
    order: 0,
    panelCounts: 0,
    droppedBlankPanels: 0,
    widths: 0,
    provenance: 0,
    fields: {},
  };
  const examples = [];
  outcome.questions.forEach((q, index) => {
    const ref = want.get(q.sourceId);
    if (!ref) return examples.push("only here: " + q.sourceId);
    tally.same++;
    if (reference.questions[index]?.sourceId !== q.sourceId) tally.order++;
    if (JSON.stringify(q.answer) !== JSON.stringify(ref.answer)) tally.answer++;
    if (q.document.answerKeyOrigin !== ref.document.answerKeyOrigin)
      tally.origin++;
    if (JSON.stringify(q.choices) !== JSON.stringify(ref.choices))
      tally.choices++;
    if (
      JSON.stringify(q.document.extractionWarnings) !==
      JSON.stringify(ref.document.extractionWarnings)
    )
      tally.warnings++;
    if (q.testStatus !== ref.testStatus) tally.status++;
    for (const kind of ["question", "rationale"]) {
      // Fully blank panels are left out on purpose, so fewer panels is expected.
      if (q.document[kind].length < ref.document[kind].length)
        tally.droppedBlankPanels++;
      else if (q.document[kind].length !== ref.document[kind].length)
        tally.panelCounts++;
      else if (q.document[kind].some((p) => p.width !== 1160)) tally.widths++;
    }
    if (
      JSON.stringify(
        q.document.provenance.map((p) => [p.filename, p.pages]),
      ) !==
      JSON.stringify(ref.document.provenance.map((p) => [p.filename, p.pages]))
    )
      tally.provenance++;
    for (const f of [
      "section",
      "domain",
      "skill",
      "difficulty",
      "stem",
      "rationale",
    ])
      if (comparable(String(q[f])) !== comparable(String(ref[f])))
        tally.fields[f] = (tally.fields[f] ?? 0) + 1;
  });
  for (const id of want.keys())
    if (!outcome.questions.some((q) => q.sourceId === id))
      examples.push("missing here: " + id);
  console.log(
    JSON.stringify(
      {
        seconds: +((Date.now() - started) / 1000).toFixed(0),
        prepared: outcome.questions.length,
        python: want.size,
        quarantined: outcome.report.quarantined.length,
        assets: outcome.assets,
        counts: outcome.report.counts,
        comparison: outcome.report.comparison,
        tally,
        examples: examples.slice(0, 5),
      },
      null,
      1,
    ),
  );
  process.exit(0);
}
const dumpId = argument("dump");
if (dumpId) {
  await page.waitForFunction(() => window.ready === true, null, {
    timeout: 120000,
  });
  const png = await page.evaluate((o) => window.dumpPanel(o), {
    id: dumpId,
    kind: argument("kind", "question"),
    index: Number(argument("index", 0)),
  });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(argument("out"), Buffer.from(png, "base64"));
  console.log("wrote", argument("out"));
  await browser.close();
  await server.close();
  process.exit(0);
}
const started = Date.now();
// Vite may reload the page once after optimizing dependencies; wait and retry.
let outcome;
for (let attempt = 0; attempt < 4 && !outcome; attempt++) {
  try {
    await page.waitForFunction(() => window.ready === true, null, {
      timeout: 120000,
    });
    outcome = await page.evaluate((options) => window.runCheck(options), {
      files,
      step,
      offset,
      limit,
    });
  } catch (error) {
    if (!/context was destroyed|navigation/i.test(String(error))) throw error;
  }
}
const { checked, results, timing } = outcome;
await browser.close();
await server.close();

const errors = results.filter((r) => r.error);
const panelCountMismatch = results.filter(
  (r) => !r.error && r.panels[0] > r.panels[1],
);
const compared = results
  .filter((r) => !r.error && r.dims.length)
  .flatMap((r) => r.dims.map((d) => ({ ...d, id: r.id, kind: r.kind })));
const sameSize = compared.filter(
  (d) => d.mine[0] === d.want[0] && d.mine[1] === d.want[1],
);
const heightDelta = compared.map((d) => d.mine[1] - d.want[1]);
const histogram = {};
for (const delta of heightDelta) histogram[delta] = (histogram[delta] ?? 0) + 1;
const shifts = {};
for (const d of compared) shifts[d.dy] = (shifts[d.dy] ?? 0) + 1;
const outliers = compared
  .filter((d) => Math.abs(d.mine[1] - d.want[1]) >= 3)
  .map((d) => ({
    id: d.id,
    kind: d.kind,
    mine: d.mine,
    want: d.want,
    dy: d.dy,
    blockMax: +d.blockMax.toFixed(1),
  }));
const worst = [...compared].sort((a, b) => b.blockMax - a.blockMax).slice(0, 6);
const blocks = { under10: 0, from10to25: 0, from25to50: 0, over50: 0 };
for (const d of compared)
  blocks[
    d.blockMax < 10
      ? "under10"
      : d.blockMax < 25
        ? "from10to25"
        : d.blockMax < 50
          ? "from25to50"
          : "over50"
  ]++;
const mean = (list) =>
  list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
console.log(
  JSON.stringify(
    {
      questionsChecked: checked,
      seconds: +((Date.now() - started) / 1000).toFixed(1),
      msPerPanel: +(timing.ms / Math.max(1, timing.panels)).toFixed(1),
      errors: errors.slice(0, 5),
      errorCount: errors.length,
      panelCountMismatch: panelCountMismatch.length,
      panelsCompared: compared.length,
      identicalSize: sameSize.length,
      heightDeltaHistogram: histogram,
      alignmentShiftHistogram: shifts,
      worstBlockDifference: blocks,
      heightOutliers: outliers,
      meanAbsDiff: +mean(compared.map((d) => d.mean)).toFixed(3),
      meanDifferingPixelShare: +mean(compared.map((d) => d.differing)).toFixed(
        5,
      ),
      worst: worst.map((d) => ({
        dy: d.dy,
        id: d.id,
        kind: d.kind,
        mine: d.mine,
        want: d.want,
        blockMax: +d.blockMax.toFixed(1),
        mean: +d.mean.toFixed(2),
        differing: +d.differing.toFixed(4),
      })),
      blobTypes: [...new Set(results.flatMap((r) => r.blobTypes ?? []))],
    },
    null,
    1,
  ),
);
