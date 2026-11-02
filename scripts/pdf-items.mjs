/** Local-only: prints pdf.js text items on one page, optionally around a search string. */
import { readFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
const [file, number, needle = "", span = "4"] = process.argv.slice(2);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(file)),
  isEvalSupported: false,
}).promise;
const page = await doc.getPage(+number);
const { items } = await page.getTextContent();
const hits = needle
  ? items
      .map((i, k) =>
        i.str && i.str.toLowerCase().includes(needle.toLowerCase()) ? k : -1,
      )
      .filter((k) => k >= 0)
  : [];
const want = new Set(
  hits.flatMap((at) =>
    Array.from({ length: 2 * +span + 1 }, (_, d) => at - +span + d),
  ),
);
items.forEach((i, k) => {
  if (i.str === undefined || (needle && !want.has(k))) return;
  console.log(
    k,
    JSON.stringify(i.str.slice(0, 40)),
    "x",
    i.transform[4].toFixed(2),
    "end",
    (i.transform[4] + i.width).toFixed(2),
    "base",
    (page.view[3] - i.transform[5]).toFixed(1),
    "h",
    i.height.toFixed(2),
    i.hasEOL ? "EOL" : "",
  );
});
