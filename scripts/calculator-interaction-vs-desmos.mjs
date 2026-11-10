/**
 * Local-only hands-on checks of the Offline graph next to official Desmos:
 * zoom and pan steps, tracing and points of interest (Offline), and how long
 * drawing and panning take with several heavy curves.
 *
 *   node scripts/calculator-interaction-vs-desmos.mjs
 *
 * Needs a build (npm run build), DESMOS_API_KEY in .env.local and internet.
 * Never runs in CI. Timings depend on the machine; compare the two columns.
 */
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = [".env.local", "../../../.env.local"].map((p) => resolve(p)).find((p) => existsSync(p));
const key = envFile && /^DESMOS_API_KEY=(.*)$/m.exec(readFileSync(envFile, "utf8"))?.[1]?.trim();
if (!key) throw new Error("DESMOS_API_KEY not found in .env.local");

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { middlewareMode: true } });
const { parseQuestions } = await vite.ssrLoadModule("/src/importing/json.ts");
const { emptyData } = await vite.ssrLoadModule("/src/core/model.ts");
const data = { ...emptyData(), questions: parseQuestions(JSON.parse(readFileSync("tests/fixtures/synthetic.json", "utf8"))) };
await vite.close();

const server = spawn("node", ["scripts/serve.ts", "--port", "4332", "--no-local-library", "--no-local-config"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: "msedge" });

async function offline(entries, window = [-10, 10, -10, 10]) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => (Math.random = () => 0.999999));
  await page.goto("http://127.0.0.1:4332/");
  await page.evaluate(async (value) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("sat-study-local", 2);
      r.onupgradeneeded = () => { for (const n of ["state", "assets"]) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => { const tx = db.transaction("state", "readwrite"); tx.objectStore("state").put(value, "current"); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, data);
  await page.reload();
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  const started = Date.now();
  for (let i = 0; i < entries.length; i++) {
    const box = page.getByRole("textbox", { name: `Expression ${i + 1}`, exact: true });
    await box.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await box.evaluate((element, value) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", value);
      element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
    }, entries[i]);
    if (i < entries.length - 1) await page.keyboard.press("Enter");
  }
  const entered = Date.now() - started;
  await page.getByText("Graph window", { exact: true }).click();
  const [xMin, xMax, yMin, yMax] = window;
  for (const [name, value] of [["xMin", xMin], ["yMin", yMin], ["xMax", xMax], ["yMax", yMax]])
    await page.getByLabel(name, { exact: true }).fill(String(value));
  await page.getByRole("button", { name: "Apply window", exact: true }).click();
  await page.waitForTimeout(500);
  const plane = page.locator(".graph-plane");
  const bounds = () => plane.evaluate((svg) => ({ left: +svg.dataset.xMin, right: +svg.dataset.xMax, bottom: +svg.dataset.yMin, top: +svg.dataset.yMax }));
  return { page, context, plane, bounds, entered };
}

const desmosPage = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await desmosPage.route("http://desmos.local/**", (route) =>
  route.fulfill({ contentType: "text/html", body: `<body style="margin:0"><div id="c" style="width:900px;height:600px"></div><script src="https://www.desmos.com/api/v1.12/calculator.js?apiKey=${key}"></script></body>` }),
);
await desmosPage.goto("http://desmos.local/");
await desmosPage.waitForFunction(() => window.Desmos, null, { timeout: 30000 });
const B = String.fromCharCode(92);
const tex = (t) => t.replaceAll("@", B);
async function desmos(latex, bounds) {
  await desmosPage.evaluate(({ exprs, bounds }) => {
    window.calc?.destroy();
    window.calc = Desmos.GraphingCalculator(document.getElementById("c"), { keypad: false, expressions: false, settingsMenu: false });
    calc.setExpressions(exprs);
    calc.setMathBounds(bounds);
  }, { exprs: latex.map((l, i) => ({ id: "e" + i, latex: tex(l) })), bounds });
  await desmosPage.waitForTimeout(1000);
  const box = await (await desmosPage.$("#c")).boundingBox();
  const read = () => desmosPage.evaluate(() => ({ ...calc.graphpaperBounds.mathCoordinates }));
  return { box, read };
}
const span = (b) => ({ x: +(b.right - b.left).toFixed(4), y: +(b.top - b.bottom).toFixed(4) });
const ratio = (before, after) => ({ x: +(span(after).x / span(before).x).toFixed(3), y: +(span(after).y / span(before).y).toFixed(3) });

const report = {};

// Zoom: one wheel notch, and the plus button, from the same starting window.
{
  const o = await offline(["y=x^2"]);
  const start = await o.bounds();
  const box = await o.plane.boundingBox();
  await o.plane.focus();
  await o.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await o.page.mouse.wheel(0, -100);
  await o.page.waitForTimeout(300);
  const afterWheel = await o.bounds();
  await o.page.getByRole("button", { name: "Zoom in" }).click();
  await o.page.waitForTimeout(300);
  const afterButton = await o.bounds();
  report.zoom = { offline: { wheelNotchIn: ratio(start, afterWheel), plusButton: ratio(afterWheel, afterButton) } };
  await o.context.close();
  const d = await desmos(["y=x^2"], { left: start.left, right: start.right, bottom: start.bottom, top: start.top });
  const before = await d.read();
  await desmosPage.mouse.move(d.box.x + d.box.width / 2, d.box.y + d.box.height / 2);
  await desmosPage.mouse.wheel(0, -100);
  await desmosPage.waitForTimeout(600);
  const dWheel = await d.read();
  await desmosPage.getByRole("button", { name: /zoom in/i }).click().catch(() => {});
  await desmosPage.waitForTimeout(800);
  const dButton = await d.read();
  report.zoom.desmos = { wheelNotchIn: ratio(before, dWheel), plusButton: ratio(dWheel, dButton) };
}

// Pan: drag 100 pixels to the right on empty space.
{
  const o = await offline(["y=x^2"], [-10, 10, -10, 10]);
  const box = await o.plane.boundingBox();
  const before = await o.bounds();
  const y = box.y + box.height * 0.2;
  await o.page.mouse.move(box.x + box.width * 0.3, y);
  await o.page.mouse.down();
  await o.page.mouse.move(box.x + box.width * 0.3 + 100, y, { steps: 10 });
  await o.page.mouse.up();
  await o.page.waitForTimeout(300);
  const after = await o.bounds();
  const perPixel = (before.right - before.left) / box.width;
  report.pan = { offline: { shiftInPixels: +(((before.left - after.left) / perPixel)).toFixed(1) } };
  await o.context.close();
  const d = await desmos(["y=x^2"], { left: before.left, right: before.right, bottom: before.bottom, top: before.top });
  const b = await d.read();
  const dPerPixel = (b.right - b.left) / d.box.width;
  await desmosPage.mouse.move(d.box.x + d.box.width * 0.3, d.box.y + d.box.height * 0.2);
  await desmosPage.mouse.down();
  await desmosPage.mouse.move(d.box.x + d.box.width * 0.3 + 100, d.box.y + d.box.height * 0.2, { steps: 10 });
  await desmosPage.mouse.up();
  await desmosPage.waitForTimeout(400);
  const a = await d.read();
  report.pan.desmos = { shiftInPixels: +(((b.left - a.left) / dPerPixel)).toFixed(1) };
}

// Tracing and points of interest in Offline.
{
  const o = await offline(["y=x^2-4x+1", "y=x-3"], [-4, 8, -6, 8]);
  await o.page.getByRole("button", { name: "Inspect points" }).click();
  await o.page.waitForTimeout(400);
  const labels = await o.page.locator(".graph-interest").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  report.pointsOfInterest = { offlineLabels: labels };
  await o.context.close();
}

// Speed: draw six heavy curves, then pan across them for 60 moves.
{
  const heavy = ["y=sin(1/x)", "y=tan(x)", "y=x^3-6x", "y=abs(x^2-4)", "y=2^x", "y=ln(abs(x))"];
  const heavyLatex = ["y=@sin(@frac{1}{x})", "y=@tan(x)", "y=x^3-6x", "y=@left|x^2-4@right|", "y=2^{x}", "y=@ln(@left|x@right|)"];
  const frames = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    return { frames: list.length, mean: +(list.reduce((a, b) => a + b, 0) / list.length).toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), worst: +sorted.at(-1).toFixed(1) };
  };
  const collect = (page) =>
    page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; window.__run && requestAnimationFrame(tick); }; window.__run = true; requestAnimationFrame(tick); });
  const stop = (page) => page.evaluate(() => { window.__run = false; return window.__gaps.slice(2); });

  const o = await offline(heavy, [-10, 10, -10, 10]);
  const box = await o.plane.boundingBox();
  await collect(o.page);
  await o.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.1);
  await o.page.mouse.down();
  for (let i = 1; i <= 60; i++) await o.page.mouse.move(box.x + box.width * 0.2 + i * 4, box.y + box.height * 0.1 + i, { steps: 1 });
  await o.page.mouse.up();
  const offlineFrames = await stop(o.page);
  report.speed = { offline: { enterSixHeavyCurvesMs: o.entered, pan: frames(offlineFrames) } };
  await o.context.close();

  const d = await desmos(heavyLatex, { left: -10, right: 10, bottom: -10, top: 10 });
  await collect(desmosPage);
  await desmosPage.mouse.move(d.box.x + d.box.width * 0.2, d.box.y + d.box.height * 0.1);
  await desmosPage.mouse.down();
  for (let i = 1; i <= 60; i++) await desmosPage.mouse.move(d.box.x + d.box.width * 0.2 + i * 4, d.box.y + d.box.height * 0.1 + i, { steps: 1 });
  await desmosPage.mouse.up();
  report.speed.desmos = { pan: frames(await stop(desmosPage)) };
}

console.log(JSON.stringify(report, null, 1));
await browser.close();
server.kill();
process.exit(0);
