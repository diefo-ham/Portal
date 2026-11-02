/**
 * Local-only: lists where the browser text layer differs from the Python tool's
 * page text for one export. Prints short windows around the first difference.
 *   node scripts/pdf-parity-diff.mjs --pdfs <dir> --private <dir> --name read_write_inactive [--limit 25]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { comparable } from "./pdf-compare.mjs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { fragmentsFromItems, layoutPage } from "../src/importing/pdf/layout.ts";
import { normalizedText } from "../src/importing/pdf/answers.ts";
const arg = (n, d) => {
  const i = process.argv.indexOf("--" + n);
  return i < 0 ? d : process.argv[i + 1];
};
const name = arg("name"),
  limit = +arg("limit", 25);
const cacheDir = join(arg("private"), "pdf-cache");
let reference;
for (const file of readdirSync(cacheDir))
  if (/^[0-9a-f]{64}\.json$/.test(file)) {
    const d = JSON.parse(readFileSync(join(cacheDir, file), "utf8"));
    if (d.filename === name + ".pdf") reference = d;
  }
const expected = new Map(
  reference.records.flatMap((r) => r.pages.map((p, i) => [p, r.texts[i]])),
);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(join(arg("pdfs"), name + ".pdf"))),
  isEvalSupported: false,
}).promise;
const visible = (s) =>
  s
    .replace(/\u00a0/g, "⍽")
    .replace(/\ufffd/g, "�")
    .replace(
      /[\u2000-\u200f\u2028-\u202f\u2060\ufeff]/g,
      (c) => `<U+${c.codePointAt(0).toString(16)}>`,
    );
const classify = process.argv.includes("--classify");
const pairs = {},
  unresolved = [];
let shown = 0,
  bad = 0;
const kinds = {};
for (let n = 1; n <= doc.numPages && (classify || shown < limit); n++) {
  const page = await doc.getPage(n);
  const top = page.view[3];
  const { items } = await page.getTextContent();
  const mine = comparable(
    normalizedText(layoutPage(fragmentsFromItems(items, top), top).text),
  );
  const want = comparable(normalizedText(expected.get(n) ?? ""));
  if (mine === want) continue;
  bad++;
  if (classify) {
    let a = 0,
      b = 0,
      guard = 0;
    while (a < mine.length && b < want.length && guard++ < 5000) {
      if (mine[a] === want[b]) {
        a++;
        b++;
        continue;
      }
      const ctx = `${mine[a - 1] ?? ""}${mine[a] === " " ? "␣" : (mine[a] ?? "")}`;
      if (want[b] === " " && mine[a] !== " ") {
        const k =
          "wantSpace  prev=" +
          visible(mine[a - 1] ?? "") +
          " next=" +
          visible(mine[a] ?? "");
        pairs[k] = (pairs[k] ?? 0) + 1;
        b++;
      } else if (mine[a] === " " && want[b] !== " ") {
        const k =
          "mineSpace  prev=" +
          visible(mine[a - 1] ?? "") +
          " next=" +
          visible(want[b] ?? "");
        pairs[k] = (pairs[k] ?? 0) + 1;
        a++;
      } else {
        if (unresolved.length < 8)
          unresolved.push(
            `p${n}: ${visible(mine.slice(Math.max(0, a - 15), a + 15))}  //  ${visible(want.slice(Math.max(0, b - 15), b + 15))}`,
          );
        break;
      }
    }
    continue;
  }
  let i = 0;
  while (i < mine.length && mine[i] === want[i]) i++;
  const key = `${visible(mine.slice(i, i + 3))} | ${visible(want.slice(i, i + 3))}`;
  kinds[key] = (kinds[key] ?? 0) + 1;
  shown++;
  console.log(
    `p${n} @${i}\n  mine: ${visible(mine.slice(Math.max(0, i - 25), i + 30))}\n  want: ${visible(want.slice(Math.max(0, i - 25), i + 30))}`,
  );
}
if (classify) {
  const top = Object.entries(pairs)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 40);
  console.log("pages differing:", bad);
  top.forEach(([k, v]) => console.log(String(v).padStart(6), k));
  console.log("unresolved:", unresolved.join(String.fromCharCode(10)));
}
console.log("shown", shown, "kinds", JSON.stringify(kinds));
