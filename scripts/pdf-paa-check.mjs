/**
 * Local-only check that the PAA text pipeline (src/importing/pdf/paa.ts) reads
 * the person's own PAA question PDF(s).
 *
 *   node scripts/pdf-paa-check.mjs <pdf> [<pdf> ...]
 *
 * Reads private files, writes nothing, and never runs in CI. It prints counts,
 * source IDs and page numbers only, never question text. Math pages are
 * reported first because they are the riskiest to read: typeset math, figures,
 * image choices and grid-in answers.
 */
import { readFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  fragmentsFromItems,
  layoutPage,
} from "../src/importing/pdf/layout.ts";
import {
  convertPaaRecord,
  groupPassages,
  indexPaaExport,
} from "../src/importing/pdf/paa.ts";
import { planCrops } from "../src/importing/pdf/crops.ts";

const files = process.argv.slice(2);
if (!files.length) throw new Error("Usage: node scripts/pdf-paa-check.mjs <pdf> [<pdf> ...]");

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
    layouts.push(layoutPage(fragmentsFromItems(items, top), top - bottom, right - left));
  }
  for (const record of indexPaaExport(file, layouts))
    all.push({ file, record, layouts });
}

const seen = new Set();
const unique = all.filter(({ record }) => !seen.has(record.id) && seen.add(record.id));
const groups = groupPassages(unique.map(({ record }) => record));
const readings = new Set([...groups.values()].map((group) => group.id));
const rows = unique.map(({ record, layouts }) => {
  try {
    const question = convertPaaRecord(record, groups.get(record.id));
    planCrops(record, record.pages.map((page) => layouts[page - 1]), "es");
    return { record, question };
  } catch (error) {
    return { record, error: error instanceof Error ? error.message : String(error) };
  }
});

const count = (items) => {
  const result = {};
  for (const item of items) result[item] = (result[item] ?? 0) + 1;
  return result;
};
console.log(`pages with a question: ${all.length}; unique IDs: ${unique.length}`);
console.log(`converted: ${rows.filter((r) => r.question).length}; failed: ${rows.filter((r) => r.error).length}`);
console.log("by test:", count(rows.filter((r) => r.question).map((r) => r.question.section)));
console.log("answers:", count(rows.filter((r) => r.question).map((r) => r.question.answer.type)));
console.log(`shared readings: ${readings.size}, covering ${groups.size} questions`);
const converted = rows.filter((r) => r.question).map((r) => r.question);
const skills = new Map();
for (const q of converted) {
  const key = `${q.section} / ${q.domain} / ${q.skill}`;
  skills.set(key, (skills.get(key) ?? 0) + 1);
}
console.log(
  `skills: ${new Set(rows.map((r) => r.record.skill)).size} printed, ${skills.size} after grouping; used once: ${[...skills.values()].filter((n) => n === 1).length}; fewer than 3: ${[...skills.values()].filter((n) => n < 3).length}`,
);
for (const [key, n] of [...skills].sort()) console.log(`  ${String(n).padStart(2)}  ${key}`);
const math = rows.filter((r) => r.record.section.toLowerCase().startsWith("matem"));
console.log(`\nMatemáticas first (${math.length}):`);
for (const row of math.filter((r) => r.error))
  console.log(`  FAILED ${row.record.id} page ${row.record.pages[0]}: ${row.error}`);
const gridIns = math.filter((r) => r.question?.answer.type === "numeric");
console.log(`  grid-ins read: ${gridIns.length}`, gridIns.map((r) => `${r.record.id}=[${r.question.answer.accepted.join("|")}]`).join(" "));
for (const row of rows.filter((r) => r.error && !math.includes(r)))
  console.log(`FAILED ${row.record.id} page ${row.record.pages[0]}: ${row.error}`);
process.exit(rows.some((r) => r.error) ? 1 : 0);
