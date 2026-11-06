/**
 * Local-only check that the TSI text pipeline (src/importing/pdf/tsi.ts) reads
 * the person's own TSIA2 question PDF(s).
 *
 *   node scripts/pdf-tsi-check.mjs <pdf> [<pdf> ...]
 *
 * Reads private files, writes nothing, and never runs in CI. It prints counts,
 * source IDs and page numbers only, never question text: how many questions
 * were read, Official / Original, calculator tags, reading sets, whether every
 * stored answer equals the page's own "Correct Answer" line, and anything the
 * reader could not convert. Exits 1 if any question failed or any check differs.
 */
import { readFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { fragmentsFromItems, layoutPage } from "../src/importing/pdf/layout.ts";
import { indexPaaExport } from "../src/importing/pdf/paa.ts";
import { planCrops } from "../src/importing/pdf/crops.ts";
import {
  CALCULATOR_TAG_PHRASES,
  convertTsiRecord,
  groupTsiPassages,
  isTsiRecord,
} from "../src/importing/pdf/tsi.ts";

const files = process.argv.slice(2);
if (!files.length)
  throw new Error("Usage: node scripts/pdf-tsi-check.mjs <pdf> [<pdf> ...]");

const all = [];
for (const file of files) {
  const document = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(file)),
    useSystemFonts: false,
  }).promise;
  const layouts = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const [left, bottom, right, top] = page.view;
    const { items } = await page.getTextContent();
    layouts.push(
      layoutPage(fragmentsFromItems(items, top), top - bottom, right - left),
    );
  }
  const records = indexPaaExport(file, layouts);
  const mine = records.filter(isTsiRecord);
  console.log(
    `${file.split(/[\\/]/).pop()}: ${document.numPages} pages, ${records.length} questions, ${mine.length} TSI`,
  );
  for (const record of mine) all.push({ file, record, layouts });
}

const seen = new Set();
const unique = all.filter(
  ({ record }) => !seen.has(record.id) && seen.add(record.id),
);
console.log(
  `pages with a question: ${all.length}; unique IDs: ${unique.length}` +
    (all.length === unique.length ? "" : "  (DUPLICATE IDS)"),
);
const groups = groupTsiPassages(unique.map(({ record }) => record));
const sets = new Map();
for (const [id, group] of groups)
  sets.set(group.id, [...(sets.get(group.id) ?? []), id]);

const count = (items) => {
  const result = {};
  for (const item of items) result[item] = (result[item] ?? 0) + 1;
  return result;
};
let problems = 0;
const converted = [];
for (const { record, layouts } of unique) {
  try {
    const { text, notes } = convertTsiRecord(record, groups.get(record.id));
    const plans = planCrops(
      record,
      record.pages.map((page) => layouts[page - 1]),
      "en",
      { maskPhrases: CALCULATOR_TAG_PHRASES },
    );
    // The answer in the page's own text must equal what was stored.
    const key = /Correct Answer:\s*([A-D])/.exec(record.texts.join("\n"))?.[1];
    if (text.answer.value !== key) {
      problems++;
      console.log(`ANSWER MISMATCH ${record.id} page ${record.pages[0]}`);
    }
    // Every tagged Math question must have its tag found in the picture to paint over.
    const masked = plans.some((p) => p.kind === "question" && p.mask?.length);
    if (text.calculator && !masked) {
      problems++;
      console.log(
        `TAG NOT FOUND IN PICTURE ${record.id} page ${record.pages[0]}`,
      );
    }
    for (const note of notes) console.log(`note ${record.id}: ${note}`);
    converted.push(text);
  } catch (error) {
    problems++;
    console.log(
      `FAILED ${record.id} page ${record.pages[0]}: ${error instanceof Error ? error.message : error}`,
    );
  }
}
console.log(
  `converted: ${converted.length}; failed: ${unique.length - converted.length}`,
);
console.log("by test:", count(converted.map((q) => q.section)));
console.log("origin:", count(converted.map((q) => `${q.section} ${q.origin}`)));
console.log(
  "calculator:",
  count(
    converted
      .filter((q) => q.section === "tsi-math")
      .map((q) => q.calculator ?? "none"),
  ),
);
console.log("difficulty:", count(converted.map((q) => q.difficulty)));
console.log(
  "domains:",
  count(converted.map((q) => `${q.section} / ${q.domain}`)),
);
console.log(
  `skills: ${new Set(converted.map((q) => `${q.section}/${q.skill}`)).size} distinct; ` +
    `reading sets: ${sets.size} (sizes ${[...sets.values()].map((m) => m.length).join(", ")}) covering ${groups.size} questions; ` +
    `single readings kept with their question: ${converted.filter((q) => q.passage && !q.passageGroup).length}`,
);
process.exit(problems ? 1 : 0);
