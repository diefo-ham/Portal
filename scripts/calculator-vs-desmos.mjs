/**
 * Local-only comparison of this app's Offline calculator with official Desmos.
 *
 *   node scripts/calculator-vs-desmos.mjs [--only values,functions,fits,analytic,syntax] [--json out.json]
 *
 * Reads DESMOS_API_KEY from .env.local (never printed), runs the cases in
 * scripts/calculator-corpus.mjs through the Offline engine in Node and through
 * Desmos in a headless browser, and lists every disagreement. Needs internet.
 * Never runs in CI. Nothing from the app's study data is involved.
 */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { values, functions, fits, analytic, syntax } from "./calculator-corpus.mjs";

const argument = (name, fallback) => {
  const index = process.argv.indexOf("--" + name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const only = argument("only")?.split(",");
const wanted = (name) => !only || only.includes(name);

const envFile = [".env.local", "../../../.env.local"]
  .map((p) => resolve(p))
  .find((p) => existsSync(p));
const key = envFile && /^DESMOS_API_KEY=(.*)$/m.exec(readFileSync(envFile, "utf8"))?.[1]?.trim();
if (!key) {
  console.error("DESMOS_API_KEY not found in .env.local");
  process.exit(1);
}
const BACKSLASH = String.fromCharCode(92);
const tex = (text) => text.replaceAll("@", BACKSLASH);

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { middlewareMode: true } });
const workspace = await vite.ssrLoadModule("/src/calculator/workspace.ts");
const model = await vite.ssrLoadModule("/src/calculator/model.ts");
const numerics = await vite.ssrLoadModule("/src/calculator/numerics.ts");

const expr = (id, text) => ({ id, type: "expression", text, hidden: false });
const run = (entries, angle = "radians") => {
  try {
    return workspace.calculateWorkspace({ ...model.emptyCalculator(), entries, angle });
  } catch (error) {
    return { threw: String(error.message ?? error), graphs: [], results: {} };
  }
};
const finite = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage();
await page.route("http://desmos.local/**", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: `<div id="c" style="width:800px;height:600px"></div><script src="https://www.desmos.com/api/v1.12/calculator.js?apiKey=${key}"></script>`,
  }),
);
await page.goto("http://desmos.local/");
await page.waitForFunction(() => window.Desmos, null, { timeout: 30000 });
const desmos = (job) =>
  page.evaluate(async (j) => {
    const calc = Desmos.GraphingCalculator(document.getElementById("c"), { keypad: false, expressions: true, settingsMenu: false });
    if (j.deg) calc.updateSettings({ degreeMode: true });
    calc.setExpressions(j.exprs);
    const helpers = j.probes.map((latex) => calc.HelperExpression({ latex }));
    await new Promise((resolve) => setTimeout(resolve, 650));
    const out = {
      analysis: JSON.parse(JSON.stringify(calc.expressionAnalysis)),
      probes: helpers.map((h) => ({ n: h.numericValue ?? null, l: h.listValue ?? null })),
    };
    calc.destroy();
    return out;
  }, job);

const same = (a, b, tolerance = 1e-9) =>
  a === null || b === null
    ? a === b
    : Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));
const sameAny = (a, b, tolerance) =>
  Array.isArray(a) || Array.isArray(b)
    ? Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(finite(v), finite(b[i]), tolerance))
    : same(a, b, tolerance);
const show = (v) => (Array.isArray(v) ? `[${v.map((x) => (x === null ? "undefined" : +Number(x).toPrecision(10))).join(", ")}]` : v === null || v === undefined ? "undefined" : String(+Number(v).toPrecision(12)));

const report = { values: [], functions: [], fits: [], analytic: [], syntax: [] };
const mismatches = [];
const note = (category, label, detail) => {
  mismatches.push({ category, label, ...detail });
};

if (wanted("values"))
  for (const [label, ours, theirs, options = {}] of values) {
    const w = run([expr("v", ours)], options.deg ? "degrees" : "radians");
    const r = w.results.v ?? {};
    const mine = r.error || w.threw ? { error: r.error ?? w.threw } : { value: r.values ? r.values.map(finite) : finite(r.value) };
    const d = await desmos({ deg: options.deg, exprs: [{ id: "v", latex: tex(theirs) }], probes: [tex(theirs)] });
    const analysis = d.analysis.v ?? {};
    const evaluation = analysis.evaluation;
    const probe = d.probes[0];
    const other = analysis.isError
      ? { error: analysis.errorMessage ?? "error" }
      : { value: probe.l ? probe.l.map(finite) : finite(evaluation?.type === "Number" ? evaluation.value : probe.n) };
    const entry = { label, ours, desmos: other, mine, expect: options.expect };
    report.values.push(entry);
    // "Undefined" is an error message in one calculator and a blank value in the other.
    const blank = (v) => "error" in v || v.value === null;
    const agree = "error" in mine || "error" in other ? blank(mine) && blank(other) : sameAny(mine.value, other.value);
    const expectOk = (got) => options.expect === undefined || ("value" in got && sameAny(got.value, options.expect, 1e-9)) || (options.expect === null && ("error" in got || got.value === null));
    if (!agree || !expectOk(mine) || !expectOk(other))
      note("values", label, { input: ours, offline: mine.error ? "error: " + mine.error : show(mine.value), desmos: other.error ? "error: " + other.error : show(other.value), truth: options.expect === undefined ? "" : show(options.expect), offlineRight: expectOk(mine), desmosRight: expectOk(other) });
  }

if (wanted("functions"))
  for (const [label, ours, theirs, xs] of functions) {
    const w = run([expr("f", ours)]);
    const graph = w.graphs.find((g) => g.id === "f");
    const mine = xs.map((x) => (graph?.fn ? finite(graph.fn(x)) : null));
    const err = w.results.f?.error ?? w.threw;
    const d = await desmos({ exprs: [{ id: "f", latex: tex(theirs) }], probes: xs.map((x) => `f(${x})`) });
    const other = d.probes.map((p) => finite(p.n));
    const ok = !err && mine.every((v, i) => same(v, other[i], 1e-9));
    report.functions.push({ label, mine, other, err });
    if (!ok) note("functions", label, { input: ours, offline: err ? "error: " + err : show(mine), desmos: d.analysis.f?.isError ? "error: " + d.analysis.f.errorMessage : show(other), at: xs.join(", ") });
  }

if (wanted("fits"))
  for (const fit of fits) {
    const entries = [];
    if (fit.data.length)
      entries.push({ id: "t", type: "table", rows: fit.data.map(([x, y]) => [String(x), String(y)]), hidden: false, fit: "none", columns: ["x_1", "y_1"] });
    entries.push(expr("r", fit.ours));
    const w = run(entries);
    const r = w.results.r ?? {};
    const mine = r.error || w.threw ? { error: r.error ?? w.threw } : { params: fit.names.map((n) => finite(r.parameters?.[n])), message: r.message };
    const exprs = [];
    if (fit.data.length)
      exprs.push({ id: "t", type: "table", columns: [{ latex: tex("x_1"), values: fit.data.map((p) => String(p[0])) }, { latex: tex("y_1"), values: fit.data.map((p) => String(p[1])) }] });
    exprs.push({ id: "r", latex: tex(fit.desmos) });
    const d = await desmos({ exprs, probes: fit.names });
    const analysis = d.analysis.r ?? {};
    const other = analysis.isError ? { error: analysis.errorMessage } : { params: d.probes.map((p) => finite(p.n)) };
    report.fits.push({ label: fit.label, mine, other });
    const agree = "error" in mine || "error" in other ? "error" in mine && "error" in other : mine.params.every((v, i) => same(v, other.params[i], 1e-5));
    if (!agree) note("fits", fit.label, { input: fit.ours, offline: mine.error ? "error: " + mine.error : fit.names.map((n, i) => `${n}=${show(mine.params[i])}`).join(", ") + (mine.message ? ` (${mine.message})` : ""), desmos: other.error ? "error: " + other.error : fit.names.map((n, i) => `${n}=${show(other.params[i])}`).join(", ") });
  }

if (wanted("analytic"))
  for (const c of analytic) {
    const w = run(c.entries.map((text, i) => expr("e" + i, text)));
    const view = { xMin: -25, xMax: 25, yMin: -25, yMax: 25 };
    const found = w.threw ? [] : numerics.interests(w.graphs, view).filter((p) => p.graphIds.length >= 2 || /intersect/i.test(p.label));
    const tolerance = c.loose ?? 1e-4;
    const missing = c.expect.filter(([x, y]) => !found.some((p) => Math.abs(p.x - x) <= tolerance && Math.abs(p.y - y) <= tolerance));
    const extra = found.filter((p) => !c.expect.some(([x, y]) => Math.abs(p.x - x) <= tolerance && Math.abs(p.y - y) <= tolerance));
    report.analytic.push({ label: c.label, found: found.map((p) => [p.x, p.y]) });
    if (missing.length || extra.length)
      note("analytic", c.label, { input: c.entries.join("  and  "), offline: found.map((p) => `(${show(p.x)}, ${show(p.y)})`).join(" ") || "none", truth: c.expect.map(([x, y]) => `(${x}, ${y})`).join(" ") || "none", missing: missing.length, extra: extra.length });
  }

if (wanted("syntax"))
  for (const [label, ours, theirs] of syntax) {
    const w = run([expr("e", ours)]);
    const r = w.results.e ?? {};
    // Desmos offers a slider for an undefined variable; so does Offline ("Add t slider").
    const mine = w.threw || r.error ? (w.missing?.length ? "accepted" : "rejected") : "accepted";
    const d = await desmos({ exprs: [{ id: "e", latex: tex(theirs) }], probes: [] });
    const a = d.analysis.e;
    const other = !a || a.isError ? "rejected" : "accepted";
    report.syntax.push({ label, mine, other });
    if (mine !== other) note("syntax", label, { input: ours, offline: mine + (r.error ? ` (${r.error})` : ""), desmos: other + (a?.errorMessage ? ` (${a.errorMessage})` : "") });
  }

await browser.close();
await vite.close();

const totals = Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.length]));
console.log("cases run:", JSON.stringify(totals));
const byCategory = {};
for (const m of mismatches) (byCategory[m.category] ??= []).push(m);
for (const [category, list] of Object.entries(byCategory)) {
  console.log(`\n== ${category}: ${list.length} of ${totals[category]} differ ==`);
  for (const m of list) {
    const { category: _c, label, ...rest } = m;
    console.log(`- ${label}: ${Object.entries(rest).filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => `${k}=${v}`).join(" | ")}`);
  }
}
if (!mismatches.length) console.log("\nNo differences.");
if (argument("json")) writeFileSync(argument("json"), JSON.stringify({ report, mismatches }, null, 1));
process.exit(0);
