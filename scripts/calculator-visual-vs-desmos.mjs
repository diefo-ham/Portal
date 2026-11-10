/**
 * Local-only side-by-side pictures of this app's Offline graph and official Desmos.
 *
 *   node scripts/calculator-visual-vs-desmos.mjs --out <dir>
 *
 * Needs a build (npm run build), DESMOS_API_KEY in .env.local and internet.
 * For each scenario it types the entries into the Offline calculator, reads the
 * window the graph ended up with, shows the same window in Desmos, and saves
 * one picture (Offline left, Desmos right). Never runs in CI.
 */
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argument = (name, fallback) => {
  const index = process.argv.indexOf("--" + name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const out = resolve(argument("out", "calculator-visual"));
mkdirSync(out, { recursive: true });
const only = argument("only")?.split(",");

const envFile = [".env.local", "../../../.env.local"].map((p) => resolve(p)).find((p) => existsSync(p));
const key = envFile && /^DESMOS_API_KEY=(.*)$/m.exec(readFileSync(envFile, "utf8"))?.[1]?.trim();
if (!key) throw new Error("DESMOS_API_KEY not found in .env.local");
const B = String.fromCharCode(92);
const tex = (text) => text.replaceAll("@", B);

/** [title, Offline entries, Desmos LaTeX entries, window xMin,xMax,yMin,yMax] */
const scenarios = [
  ["parabola", ["y=x^2-4x+1"], ["y=x^2-4x+1"], [-4, 8, -6, 10]],
  ["two lines", ["y=2x+1", "y=-x+7"], ["y=2x+1", "y=-x+7"], [-4, 8, -4, 10]],
  ["line inequality", ["y<2x+1"], ["y<2x+1"], [-6, 6, -6, 6]],
  ["inclusive inequality", ["y>=abs(x)"], ["y@ge@left|x@right|"], [-6, 6, -2, 8]],
  ["circle inequality", ["x^2+y^2<=9"], ["x^2+y^2@le 9"], [-6, 6, -5, 5]],
  ["circle and line", ["x^2+y^2=25", "y=x+1"], ["x^2+y^2=25", "y=x+1"], [-8, 8, -7, 7]],
  ["ellipse", ["x^2/4+y^2/9=1"], ["@frac{x^2}{4}+@frac{y^2}{9}=1"], [-6, 6, -5, 5]],
  ["sine wave", ["y=2sin(x)+1"], ["y=2@sin(x)+1"], [-7, 7, -4, 5]],
  ["piecewise", ["y={x<0:-x,x^2/4}"], ["y=@left@{x<0:-x,@frac{x^2}{4}@right@}"], [-6, 6, -2, 8]],
  ["domain restriction", ["y=x^2{-2<x<2}"], ["y=x^2@left@{-2<x<2@right@}"], [-5, 5, -2, 6]],
  ["logarithm and reciprocal", ["y=ln(x)", "y=1/x"], ["y=@ln(x)", "y=@frac{1}{x}"], [-2, 8, -4, 4]],
  ["rational with asymptote", ["y=(x+1)/(x-2)"], ["y=@frac{x+1}{x-2}"], [-6, 10, -8, 8]],
  ["points", ["[(1,2),(3,4),(5,-1)]"], ["@left[(1,2),(3,4),(5,-1)@right]"], [-2, 8, -4, 6]],
  ["slider curve", ["a=2", "y=ax^2"], ["a=2", "y=ax^2"], [-4, 4, -2, 10]],
  [
    "data and fitted curve",
    ["x_1=[1,2,3,4,5]", "y_1=[1,4,9.5,16,25.2]", "y_1~ax_1^2+bx_1+c", "y=ax^2+bx+c"],
    ["x_1=@left[1,2,3,4,5@right]", "y_1=@left[1,4,9.5,16,25.2@right]", "y_1@sim ax_1^2+bx_1+c"],
    [-1, 7, -5, 30],
  ],
  ["exponential decay", ["y=5*0.6^x"], ["y=5@cdot 0.6^{x}"], [-3, 8, -2, 12]],
];

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { middlewareMode: true } });
const { parseQuestions } = await vite.ssrLoadModule("/src/importing/json.ts");
const { emptyData } = await vite.ssrLoadModule("/src/core/model.ts");
const sample = JSON.parse(readFileSync("tests/fixtures/synthetic.json", "utf8"));
const data = { ...emptyData(), questions: parseQuestions(sample) };
await vite.close();

const server = spawn("node", ["scripts/serve.ts", "--port", "4331", "--no-local-library", "--no-local-config"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: "msedge" });

async function ours(scenario) {
  const [, entries, , [xMin, xMax, yMin, yMax]] = scenario;
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => (Math.random = () => 0.999999));
  await page.goto("http://127.0.0.1:4331/");
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
  await page.getByText("Graph window", { exact: true }).click();
  for (const [name, value] of [["xMin", xMin], ["yMin", yMin], ["xMax", xMax], ["yMax", yMax]])
    await page.getByLabel(name, { exact: true }).fill(String(value));
  await page.getByRole("button", { name: "Apply window", exact: true }).click();
  await page.waitForTimeout(600);
  const plane = page.locator(".graph-plane");
  const box = await plane.boundingBox();
  const bounds = await plane.evaluate((svg) => ({
    left: Number(svg.dataset.xMin), right: Number(svg.dataset.xMax), bottom: Number(svg.dataset.yMin), top: Number(svg.dataset.yMax),
  }));
  const errors = await page.locator(".calc-error").allTextContents();
  const png = await plane.screenshot();
  await context.close();
  return { png, bounds, width: Math.round(box.width), height: Math.round(box.height), errors, ms: Date.now() - started };
}

const desmosPage = await browser.newPage();
await desmosPage.route("http://desmos.local/**", (route) =>
  route.fulfill({ contentType: "text/html", body: `<div id="c" style="width:900px;height:700px"></div><script src="https://www.desmos.com/api/v1.12/calculator.js?apiKey=${key}"></script>` }),
);
await desmosPage.goto("http://desmos.local/");
await desmosPage.waitForFunction(() => window.Desmos, null, { timeout: 30000 });

async function desmos(scenario, size, bounds) {
  const exprs = scenario[2].map((latex, i) => ({ id: "e" + i, latex: tex(latex) }));
  return desmosPage.evaluate(async ({ exprs, size, bounds }) => {
    const element = document.getElementById("c");
    element.style.width = size.width + "px";
    element.style.height = size.height + "px";
    const calc = Desmos.GraphingCalculator(element, { keypad: false, expressions: false, settingsMenu: false, zoomButtons: false });
    calc.setExpressions(exprs);
    calc.setMathBounds(bounds);
    await new Promise((r) => setTimeout(r, 900));
    const png = await new Promise((r) => calc.asyncScreenshot({ width: size.width, height: size.height, targetPixelRatio: 1 }, r));
    calc.destroy();
    return png;
  }, { exprs, size, bounds });
}

const rows = [];
for (const scenario of scenarios) {
  if (only && !only.includes(scenario[0])) continue;
  const mine = await ours(scenario);
  const theirs = await desmos(scenario, { width: mine.width, height: mine.height }, mine.bounds);
  const left = await loadImage(mine.png);
  const right = await loadImage(theirs);
  rows.push({ title: scenario[0], left, right, mine });
  console.log(`${scenario[0]}: ${mine.width}x${mine.height}, ${mine.ms} ms${mine.errors.length ? ", ERRORS: " + mine.errors.join(" / ") : ""}`);
}
await browser.close();
server.kill();

// One sheet per four scenarios: title, Offline on the left, Desmos on the right.
for (let start = 0; start < rows.length; start += 4) {
  const chunk = rows.slice(start, start + 4);
  const width = Math.max(...chunk.map((r) => r.left.width)) * 2 + 60;
  const height = chunk.reduce((sum, r) => sum + r.left.height + 50, 20);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  let y = 10;
  for (const r of chunk) {
    ctx.fillStyle = "#222";
    ctx.font = "18px sans-serif";
    ctx.fillText(`${r.title}    (left: Offline    right: Desmos)`, 20, y + 20);
    ctx.drawImage(r.left, 20, y + 30);
    ctx.drawImage(r.right, 40 + r.left.width, y + 30);
    y += r.left.height + 50;
  }
  const file = join(out, `sheet-${start / 4 + 1}.png`);
  writeFileSync(file, canvas.toBuffer("image/png"));
  console.log("wrote", file);
}
process.exit(0);
