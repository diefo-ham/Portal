import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ACCESS_HASHES } from "../../src/core/accessCodes";
import type { Question } from "../../src/core/model";
import { parseQuestions } from "../../src/importing/json";
import { seedStudyData } from "./seed";
import sample from "../fixtures/synthetic.json" with { type: "json" };

// Unlike the other specs, this one lets the service worker run: the pop-up is
// what a waiting new version produces, so it cannot be tested without one.
test.use({ serviceWorkers: "allow" });

const PORT = 4319;
const ORIGIN = `http://127.0.0.1:${PORT}`;

/** A 1×1 PNG, so a seeded question can have its images without an image store. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** One question that came from a PDF whose access code this build accepts. */
const fromAcceptedPdf = (): Question => {
  const [base] = parseQuestions(sample);
  const panel = { src: PIXEL, alt: "synthetic", width: 10, height: 10 };
  return {
    ...base,
    document: {
      question: [panel],
      rationale: [panel],
      textIsApproximate: true,
      provenance: [
        {
          filename: "synthetic.pdf",
          sha256: "a".repeat(64),
          pages: [1],
          access: ACCESS_HASHES.SAT[0],
        },
      ],
    },
  };
};

let server: ChildProcess | undefined;
let copy = "";

test.afterEach(() => {
  server?.kill();
  if (copy) rmSync(copy, { recursive: true, force: true });
  server = undefined;
  copy = "";
});

/** The bundled examples are off for this origin too, so nothing but the seeded question is stored. */
const withoutExamples = (page: import("@playwright/test").Page) =>
  page.addInitScript(() => localStorage.setItem("sat-bundled-examples", "off"));

/** Serves a throwaway copy of the build, so a "new version" can be put in its place. */
async function serveCopyOfBuild() {
  copy = mkdtempSync(join(tmpdir(), "sat-study-update-"));
  cpSync(resolve("dist"), join(copy, "dist"), { recursive: true });
  server = spawn(
    process.execPath,
    [
      resolve("scripts/serve.ts"),
      "--port",
      String(PORT),
      "--no-local-library",
    ],
    { cwd: copy, stdio: "ignore" },
  );
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(ORIGIN)).ok;
        } catch {
          return false;
        }
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return join(copy, "dist");
}

/**
 * Turns the served copy into "the next release": a different offline cache
 * (so the browser sees a new service worker) and, optionally, a different
 * accepted SAT code hash baked into the app.
 */
function releaseNextVersion(
  dist: string,
  options: { replaceSatHash: boolean },
) {
  const worker = join(dist, "sw.js");
  writeFileSync(
    worker,
    readFileSync(worker, "utf8").replace(
      /const CACHE = "sat-study-[0-9a-f]+"/,
      'const CACHE = "sat-study-0000000000000001"',
    ),
  );
  if (!options.replaceSatHash) return;
  let replaced = 0;
  for (const name of readdirSync(join(dist, "assets")))
    if (name.endsWith(".js")) {
      const file = join(dist, "assets", name);
      const text = readFileSync(file, "utf8");
      if (text.includes(ACCESS_HASHES.SAT[0])) {
        writeFileSync(
          file,
          text.replaceAll(ACCESS_HASHES.SAT[0], "9".repeat(64)),
        );
        replaced++;
      }
    }
  expect(replaced).toBeGreaterThan(0);
}

test("a new version covers the page with a pop-up that cannot be dismissed; updating re-checks the PDFs", async ({
  page,
}, testInfo) => {
  const dist = await serveCopyOfBuild();
  await withoutExamples(page);
  await page.goto(ORIGIN + "/");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await seedStudyData(page, { questions: [fromAcceptedPdf()] });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText(/1 questions are stored in this browser/),
  ).toBeVisible();

  // Nothing is shown while there is no new version.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The next release replaces the SAT code this question's PDF carried.
  releaseNextVersion(dist, { replaceSatHash: true });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  const popup = page.getByRole("dialog", {
    name: "A new version of the portal is ready.",
  });
  await expect(popup).toBeVisible({ timeout: 30_000 });
  await expect(popup).toContainText(
    "checks your PDFs against the current access codes",
  );
  await page.screenshot({ path: testInfo.outputPath("update-popup.png") });
  await testInfo.attach("update-popup", {
    path: testInfo.outputPath("update-popup.png"),
    contentType: "image/png",
  });

  // It cannot be dismissed: no close button, Escape and a click outside do nothing.
  await expect(popup.getByRole("button")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(popup).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(popup).toBeVisible();
  // It is a real modal: the page behind it is inert.
  expect(
    await page.evaluate(
      () => !!document.querySelector("dialog.update-dialog:modal"),
    ),
  ).toBe(true);

  // Updating reloads into the new version, which re-checks the stored PDFs.
  await Promise.all([
    page.waitForEvent("load"),
    popup.getByRole("button", { name: "Update now" }).click(),
  ]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText(
      /1 questions from PDFs without a valid access code were removed/,
    ),
  ).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("after-update.png") });
});

test("a new version that still accepts the code updates without removing anything", async ({
  page,
}) => {
  const dist = await serveCopyOfBuild();
  await withoutExamples(page);
  await page.goto(ORIGIN + "/");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await seedStudyData(page, { questions: [fromAcceptedPdf()] });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText(/1 questions are stored in this browser/),
  ).toBeVisible();
  releaseNextVersion(dist, { replaceSatHash: false });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  const popup = page.getByRole("dialog", {
    name: "A new version of the portal is ready.",
  });
  await expect(popup).toBeVisible({ timeout: 30_000 });
  await Promise.all([
    page.waitForEvent("load"),
    popup.getByRole("button", { name: "Update now" }).click(),
  ]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/were removed/)).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText(/1 questions are stored in this browser/),
  ).toBeVisible();
});
