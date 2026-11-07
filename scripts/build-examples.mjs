/**
 * Builds the example questions that ship with the app (public/examples/).
 *
 *   node scripts/build-examples.mjs --sat a.pdf b.pdf --paa c.pdf d.pdf --tsi e.pdf f.pdf
 *
 * Each flag takes one or more PDFs in the Educator Question Bank layout. They
 * are read with the same code the Add-PDFs dialog uses (in a headless browser
 * on 127.0.0.1, nothing leaves the machine), then every question is marked as
 * bundled, given the examples source and an `example-` ID, and stripped of its
 * file provenance. The PDFs are not copied anywhere: only questions.json, the
 * page images and manifest.json are written. The same PDFs always give the same
 * revision. Not run in CI.
 */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { EXAMPLES_SOURCE } from "../src/core/bundled.ts";

const KINDS = ["sat", "paa", "tsi"];
const argv = process.argv.slice(2);
const inputs = Object.fromEntries(KINDS.map((kind) => [kind, []]));
let out = resolve("public/examples");
for (let i = 0, kind; i < argv.length; i++) {
  if (argv[i] === "--out") out = resolve(argv[++i]);
  else if (argv[i].startsWith("--") && KINDS.includes(argv[i].slice(2)))
    kind = argv[i].slice(2);
  else if (kind) inputs[kind].push(resolve(argv[i]));
  else
    throw new Error(
      "Usage: build-examples.mjs --sat <pdf>... --paa <pdf>... --tsi <pdf>...",
    );
}
for (const kind of KINDS)
  for (const file of inputs[kind])
    if (!existsSync(file)) throw new Error("Not found: " + file);
if (!KINDS.some((kind) => inputs[kind].length))
  throw new Error("Give at least one PDF.");

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 4521, strictPort: true },
  optimizeDeps: {
    entries: ["scripts/build-examples.client.mjs"],
    include: ["pdfjs-dist"],
  },
  plugins: [
    {
      name: "example-pdfs",
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          const match = /^\/__pdf\/(sat|paa|tsi)\/(\d+)$/.exec(
            new URL(req.url, "http://x").pathname,
          );
          const file = match && inputs[match[1]][Number(match[2])];
          if (!file) return next();
          createReadStream(file).pipe(res);
        });
      },
    },
  ],
});
await server.listen();
// CHROMIUM_PATH points at a browser when Playwright's own download is not there.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.log("pageerror:", error.message));
  await page.goto("http://127.0.0.1:4521/scripts/build-examples.html");
  await page.waitForFunction(() => window.examplesReady === true, null, {
    timeout: 120000,
  });

  const questions = [];
  const assets = new Map();
  const reports = {};
  for (const kind of KINDS) {
    if (!inputs[kind].length) continue;
    const result = await page.evaluate(
      ([k, names]) => window.buildExamples(k, names),
      [kind, inputs[kind].map((file) => basename(file))],
    );
    const prepared = JSON.parse(result.questionsJson).questions;
    for (const [key, base64] of result.assets) assets.set(key, base64);
    reports[kind] = {
      prepared: prepared.length,
      quarantined: result.report.quarantined,
      warnings: result.report.warnings ?? [],
      ignored: result.report.ignored ?? [],
    };
    // Internal IDs say which test a question is for: example-, paa-example-, tsi-example-.
    const prefix = { sat: "", paa: "paa-", tsi: "tsi-" }[kind];
    for (const q of prepared) {
      q.id = `${prefix}example-${q.sourceId}`;
      q.source = EXAMPLES_SOURCE;
      q.bundled = true;
      q.testStatus = "unknown";
      // Where an example came from is not the person's PDF: no file, no hash.
      q.document.provenance = [];
      questions.push(q);
    }
  }
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw new Error("Duplicate example IDs.");

  const questionsJson = JSON.stringify({ schemaVersion: 1, questions });
  const used = new Set(
    questions.flatMap((q) =>
      [...q.document.question, ...q.document.rationale].map((p) =>
        p.src.slice("asset:".length),
      ),
    ),
  );
  const manifest = {
    format: "sat-study-local-library-v1",
    revision: createHash("sha256").update(questionsJson).digest("hex"),
    label: "Example questions",
    questionCount: questions.length,
    assets: [...used].sort(),
  };

  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, "assets"), { recursive: true });
  for (const key of used)
    await writeFile(
      join(out, "assets", key),
      Buffer.from(assets.get(key), "base64"),
    );
  await writeFile(join(out, "questions.json"), questionsJson);
  await writeFile(
    join(out, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const count = (items) =>
    Object.entries(
      items.reduce((acc, x) => ((acc[x] = (acc[x] ?? 0) + 1), acc), {}),
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  console.log(
    `Wrote ${questions.length} questions and ${used.size} images to ${out}`,
  );
  console.log("revision", manifest.revision);
  for (const q of ["section", "difficulty", "origin"])
    console.log(q.padEnd(11), count(questions.map((x) => String(x[q]))));
  for (const [kind, r] of Object.entries(reports))
    console.log(
      kind,
      JSON.stringify({ ...r, quarantined: r.quarantined.length }),
      r.quarantined.slice(0, 5),
    );
  console.log("files", (await readdir(join(out, "assets"))).length);
} finally {
  await browser.close();
  await server.close();
}
