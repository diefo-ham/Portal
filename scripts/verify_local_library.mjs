// Private corpus QA: no real question content is written into tracked tests.
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const library = JSON.parse(
  await readFile("private-data/library/questions.json", "utf8"),
);
const manifest = JSON.parse(
  await readFile("private-data/library/manifest.json", "utf8"),
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.route("**/*", async (route) => {
  if (route.request().url().startsWith("http://127.0.0.1:4317"))
    await route.continue();
  else await route.abort();
});
const counts = {};
try {
  await page.goto("http://127.0.0.1:4317");
  await page
    .getByRole("button", { name: "Start practice" })
    .waitFor({ timeout: 240000 });
  const stored = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const state = await new Promise((resolve, reject) => {
      const r = db.transaction("state").objectStore("state").get("current");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const assets = await new Promise((resolve) => {
      const r = db.transaction("assets").objectStore("assets").count();
      r.onsuccess = () => resolve(r.result);
    });
    return {
      questions: state.questions.length,
      imports: state.imports.length,
      assets,
      active: state.questions.filter((q) => q.testStatus === "active").length,
      inactive: state.questions.filter((q) => q.testStatus === "inactive")
        .length,
      unknown: state.questions.filter((q) => q.testStatus === "unknown").length,
    };
  });
  if (
    stored.questions !== manifest.questionCount ||
    stored.assets !== manifest.assets.length
  )
    throw new Error(
      "Incomplete library or asset import: " + JSON.stringify(stored),
    );
  Object.assign(counts, stored);
  await mkdir("private-data/inspection", { recursive: true });
  await page.getByRole("button", { name: /^Domain:/ }).click();
  const domainCount = await page
    .getByRole("group", { name: "Domain", exact: true })
    .getByRole("checkbox")
    .count();
  await page.keyboard.press("Escape");
  await page.getByText("Refine selection", { exact: true }).click();
  await page.getByRole("button", { name: /^Skill:/ }).click();
  const skillCount = await page
    .getByRole("group", { name: "Skill", exact: true })
    .getByRole("checkbox")
    .count();
  await page.keyboard.press("Escape");
  const normalize = (value) =>
    (value || "").trim().replace(/\s+/g, " ").toLowerCase();
  const expectedSkills = new Set(
    library.questions.map((q) =>
      JSON.stringify([q.section, normalize(q.domain), normalize(q.skill)]),
    ),
  ).size;
  if (skillCount !== expectedSkills || domainCount !== 8)
    throw new Error("Taxonomy options differ from the source metadata");
  counts.taxonomy = { domains: domainCount, skills: skillCount };
  await page.getByText("Refine selection", { exact: true }).click();
  await page.screenshot({
    path: resolve("private-data/inspection/stage3-real-home.png"),
    fullPage: true,
  });
  const examples = [
    library.questions.find(
      (q) =>
        q.section === "math" &&
        q.answer.type === "numeric" &&
        q.testStatus === "inactive",
    ),
    library.questions.find(
      (q) =>
        q.section === "math" &&
        q.answer.type === "choice" &&
        q.testStatus === "inactive",
    ),
    library.questions.find(
      (q) => q.section === "reading-writing" && q.testStatus === "inactive",
    ),
  ];
  for (const q of examples) {
    if (await page.getByRole("button", { name: "← Exit", exact: true }).count())
      await page.getByRole("button", { name: "← Exit", exact: true }).click();
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Search questions" })
      .fill(q.sourceId);
    await page.getByRole("button", { name: "Start practice" }).click();
    await page
      .getByLabel("Original PDF question")
      .locator("img")
      .first()
      .waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".pdf-document img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    if (await page.getByLabel("Original PDF explanation").count())
      throw new Error("Rationale shown before submission");
    const name = q.section + "-" + q.answer.type;
    await page.screenshot({
      path: resolve("private-data/inspection/" + name + "-practice.png"),
      fullPage: true,
    });
    if (q.answer.type === "numeric")
      await page.getByLabel("Your numeric answer").fill(q.answer.accepted[0]);
    else
      await page
        .getByRole("radio")
        .nth(q.choices.findIndex((c) => c.id === q.answer.value))
        .check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByText("Correct. Nicely done.").waitFor();
    await page.getByLabel("Original PDF explanation").waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".pdf-document img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await page.screenshot({
      path: resolve("private-data/inspection/" + name + "-feedback.png"),
      fullPage: true,
    });
  }
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  await page.getByText("Correct. Nicely done.").waitFor();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      passed: true,
      counts,
      examples: examples.map((q) => q.id),
      network: "All non-loopback requests blocked",
      errors,
    }),
  );
} finally {
  await context.close();
  await browser.close();
}
