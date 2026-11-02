/**
 * Local-only check that the browser text pipeline (src/importing/pdf) reproduces
 * the Python preparation tool's output for the person's own PDF exports.
 *
 *   node scripts/pdf-parity.mjs --pdfs <folder with the four PDFs> \
 *        --private <folder holding pdf-cache/ and library/> [--golden <label geometry dir>]
 *
 * Reads private files, writes nothing, and never runs in CI. Output contains
 * counts and short, truncated differences only.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { comparable } from "./pdf-compare.mjs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  fragmentsFromItems,
  layoutPage,
  findPhrase,
} from "../src/importing/pdf/layout.ts";
import { indexExport } from "../src/importing/pdf/segment.ts";
import { normalizedText } from "../src/importing/pdf/answers.ts";
import { classifyExports } from "../src/importing/pdf/classify.ts";
import {
  convertRecordText,
  recordSignature,
} from "../src/importing/pdf/record.ts";

const argument = (name) => {
  const index = process.argv.indexOf("--" + name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const pdfs = argument("pdfs");
const priv = argument("private");
const goldenDir = argument("golden");
const mode = argument("mode") ?? "active-only";
if (!pdfs || !priv)
  throw new Error(
    "Usage: --pdfs <dir> --private <dir> [--golden <dir>] [--mode active-only]",
  );

const NAMES = [
  "read_write_inactive",
  "read_write_active",
  "math_inactive",
  "math_active",
];
const clip = (text, max = 70) =>
  text.length > max ? text.slice(0, max) + "…" : text;
const first = (list, item, limit = 6) => list.length < limit && list.push(item);

// Reference data written by the Python tool.
const cacheDir = join(priv, "pdf-cache");
const caches = new Map();
for (const file of readdirSync(cacheDir))
  if (/^[0-9a-f]{64}\.json$/.test(file)) {
    const data = JSON.parse(readFileSync(join(cacheDir, file), "utf8"));
    caches.set(data.filename, data);
  }
const library = JSON.parse(
  readFileSync(join(priv, "library", "questions.json"), "utf8"),
);
const overrides = existsSync(join(priv, "pdf-overrides.json"))
  ? JSON.parse(readFileSync(join(priv, "pdf-overrides.json"), "utf8"))
  : {};

const records = {};
const report = {};
for (const name of NAMES) {
  const started = Date.now();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(join(pdfs, name + ".pdf"))),
    isEvalSupported: false,
  }).promise;
  const reference = caches.get(name + ".pdf");
  const golden = goldenDir
    ? JSON.parse(readFileSync(join(goldenDir, name + ".json"), "utf8"))
    : undefined;
  const layouts = [];
  const expectedText = new Map(
    reference.records.flatMap((record) =>
      record.pages.map((p, i) => [p, record.texts[i]]),
    ),
  );
  const stats = {
    pages: doc.numPages,
    textExact: 0,
    textNormalized: 0,
    textDiffs: [],
    geometry: { checked: 0, maxError: 0, missing: [], large: [], bias: {} },
  };
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const top = page.view[3];
    const { items } = await page.getTextContent();
    const layout = layoutPage(
      fragmentsFromItems(items, top),
      top - page.view[1],
    );
    layouts.push(layout);
    const expected = expectedText.get(number) ?? "";
    if (layout.text === expected) stats.textExact++;
    if (
      comparable(normalizedText(layout.text)) ===
      comparable(normalizedText(expected))
    )
      stats.textNormalized++;
    else
      first(stats.textDiffs, {
        page: number,
        mine: clip(normalizedText(layout.text).slice(0, 70)),
      });
    if (golden) {
      const g = golden[number - 1];
      const pairs = [
        [
          "q",
          findPhrase(layout, "Question").filter((b) => b.x0 < 25 && b.y0 > 70),
        ],
        ["k", findPhrase(layout, "Correct Answer:")],
        [
          "r",
          findPhrase(layout, "Rationale").filter((b) => b.x0 < 25 && b.y0 > 70),
        ],
      ];
      for (const [key, mine] of pairs) {
        const want = g[key][0];
        const got = mine[0];
        if (!want && !got) continue;
        if (!want || !got) {
          first(
            stats.geometry.missing,
            `${number}:${key}:${want ? "missing-mine" : "extra-mine"}`,
            8,
          );
          continue;
        }
        stats.geometry.checked++;
        for (const k of ["y0", "y1"]) {
          const b = (stats.geometry.bias[key + k] ??= {
            n: 0,
            sum: 0,
            min: 9,
            max: -9,
          });
          const d = got[k] - want[k === "y0" ? 1 : 3];
          b.n++;
          b.sum += d;
          b.min = Math.min(b.min, d);
          b.max = Math.max(b.max, d);
        }
        for (const [i, k] of ["x0", "y0", "x1", "y1"].entries())
          if (k !== "x1") {
            const error = Math.abs(want[i] - got[k]);
            stats.geometry.maxError = Math.max(stats.geometry.maxError, error);
            if (error > 1.5)
              first(
                stats.geometry.large,
                `${number}:${key}:${k}:${want[i].toFixed(1)}vs${got[k].toFixed(1)}`,
                8,
              );
          }
      }
    }
  }
  records[name] = indexExport(name + ".pdf", layouts);
  // Segmentation and metadata against the Python index.
  const seg = {
    questions: records[name].length,
    expected: reference.records.length,
    idPagesMismatch: 0,
    metaMismatch: 0,
    diffs: [],
  };
  const byId = new Map(reference.records.map((r) => [r.id, r]));
  for (const r of records[name]) {
    const ref = byId.get(r.id);
    if (!ref || JSON.stringify(ref.pages) !== JSON.stringify(r.pages)) {
      seg.idPagesMismatch++;
      first(seg.diffs, { id: r.id, pages: r.pages.join(",") });
      continue;
    }
    for (const field of ["section", "domain", "skill", "difficulty"])
      if (ref[field] !== r[field]) {
        seg.metaMismatch++;
        first(seg.diffs, { id: r.id, field, mine: r[field], want: ref[field] });
      }
  }
  for (const b of Object.values(stats.geometry.bias)) {
    b.mean = +(b.sum / b.n).toFixed(3);
    b.min = +b.min.toFixed(2);
    b.max = +b.max.toFixed(2);
    delete b.sum;
  }
  report[name] = {
    seconds: +((Date.now() - started) / 1000).toFixed(1),
    ...stats,
    segmentation: seg,
  };
  console.log(
    name,
    JSON.stringify({
      ...report[name],
      textDiffs: report[name].textDiffs.length,
    }),
  );
}

// Final text fields against the prepared library.
const classification = classifyExports(
  [
    {
      group: "read_write",
      inactive: records.read_write_inactive,
      active: records.read_write_active,
    },
    {
      group: "math",
      inactive: records.math_inactive,
      active: records.math_active,
    },
  ],
  mode,
);
const collected = new Map();
for (const name of NAMES)
  for (const record of records[name])
    (
      collected.get(record.id) ?? collected.set(record.id, []).get(record.id)
    ).push(record);
const mine = new Map();
const quarantined = [];
for (const [id, occurrences] of collected) {
  try {
    if (new Set(occurrences.map(recordSignature)).size > 1)
      throw new Error("Same source ID has conflicting metadata or answer keys");
    const q = convertRecordText(occurrences[0], overrides[id]);
    q.testStatus = classification.statuses.get(id);
    mine.set(q.sourceId, q);
  } catch (error) {
    quarantined.push({ id, reason: error.message });
  }
}
const want = new Map(library.questions.map((q) => [q.sourceId, q]));
const fields = [
  "section",
  "domain",
  "skill",
  "difficulty",
  "stem",
  "rationale",
  "testStatus",
];
const tally = {
  sameIds: 0,
  onlyMine: [],
  onlyPython: [],
  answerMismatch: [],
  originMismatch: 0,
  choicesMismatch: 0,
  warningMismatch: 0,
  fields: Object.fromEntries(
    fields.map((f) => [f, { mismatch: 0, examples: [] }]),
  ),
};
for (const [id, q] of mine) {
  const ref = want.get(id);
  if (!ref) {
    first(tally.onlyMine, id, 10);
    continue;
  }
  tally.sameIds++;
  if (JSON.stringify(q.answer) !== JSON.stringify(ref.answer))
    first(tally.answerMismatch, { id, mine: q.answer, want: ref.answer }, 10);
  if (q.answerKeyOrigin !== ref.document.answerKeyOrigin)
    tally.originMismatch++;
  if (JSON.stringify(q.choices) !== JSON.stringify(ref.choices))
    tally.choicesMismatch++;
  if (
    JSON.stringify(q.extractionWarnings) !==
    JSON.stringify(ref.document.extractionWarnings)
  )
    tally.warningMismatch++;
  for (const f of fields)
    if (comparable(String(q[f])) !== comparable(String(ref[f]))) {
      tally.fields[f].mismatch++;
      first(
        tally.fields[f].examples,
        { id, mine: clip(String(q[f])), want: clip(String(ref[f])) },
        3,
      );
    }
}
for (const id of want.keys())
  if (!mine.has(id)) first(tally.onlyPython, id, 10);
console.log(
  "\nPython library questions:",
  want.size,
  " browser pipeline questions:",
  mine.size,
  " quarantined:",
  quarantined.length,
);
console.log(
  JSON.stringify(
    {
      ...tally,
      onlyMine: tally.onlyMine.length ? tally.onlyMine : 0,
      onlyPython: tally.onlyPython.length ? tally.onlyPython : 0,
    },
    null,
    1,
  ),
);
if (quarantined.length)
  console.log("quarantine sample:", JSON.stringify(quarantined.slice(0, 5)));
console.log(
  "comparison:",
  JSON.stringify(classification.comparison),
  "conflicts:",
  classification.conflicts.length,
);
