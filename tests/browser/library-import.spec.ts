import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A one-pixel PNG stands in for a question image; the importer checks bytes, not format.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0kAAAAASUVORK5CYII=",
  "base64",
);

/** Writes a synthetic prepared library folder, optionally corrupted, and returns its path. */
function makeLibrary(options: { tamper?: boolean; noManifest?: boolean } = {}) {
  const hash = createHash("sha256").update(pixel).digest("hex");
  const panel = {
    src: `asset:${hash}.webp`,
    alt: "Synthetic original layout",
    width: 1,
    height: 1,
  };
  const questions = JSON.stringify({
    schemaVersion: 1,
    questions: [
      {
        id: "own-1",
        sourceId: "own-1",
        source: "Original test data",
        section: "math",
        stem: "Searchable transcript",
        domain: "Algebra",
        skill: "Linear functions",
        difficulty: "easy",
        testStatus: "inactive",
        choices: [
          { id: "A", text: "Option A" },
          { id: "B", text: "Option B" },
        ],
        answer: { type: "choice", value: "B" },
        rationale: "Extracted rationale",
        document: {
          question: [panel],
          rationale: [{ ...panel, alt: "Synthetic explanation" }],
          textIsApproximate: true,
          provenance: [
            { filename: "own.pdf", sha256: "a".repeat(64), pages: [1] },
          ],
        },
      },
    ],
  });
  const dir = mkdtempSync(join(tmpdir(), "sat-study-library-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(
    join(dir, "assets", hash + ".webp"),
    options.tamper ? Buffer.from("not the declared image") : pixel,
  );
  writeFileSync(join(dir, "questions.json"), questions);
  if (!options.noManifest)
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        format: "sat-study-local-library-v1",
        revision: createHash("sha256").update(questions).digest("hex"),
        questionCount: 1,
        assets: [hash + ".webp"],
        label: "My prepared library",
      }),
    );
  return dir;
}

async function openMaintenance(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Library & maintenance", { exact: true }).click();
}

test("a person imports their own prepared library folder and keeps it offline", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("import your own prepared library"),
  ).toBeVisible();
  await openMaintenance(page);
  await page.getByLabel("Import library folder").setInputFiles(makeLibrary());
  await expect(page.getByText(/Library imported: 1 questions/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".question-row")).toHaveCount(1);
  await page.locator(".question-row-main").click();
  await expect(
    page.getByLabel("Original PDF question").locator("img"),
  ).toBeVisible();
  // Spoiler rule: the explanation stays hidden until the question is answered.
  await expect(page.getByLabel("Original PDF explanation")).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Library & maintenance", { exact: true }).click();
  await page.getByLabel("Import library folder").setInputFiles(makeLibrary());
  await expect(page.getByText(/already imported/)).toBeVisible();
});

test("a library whose image fails its checksum is rejected", async ({
  page,
}) => {
  await page.goto("/");
  await openMaintenance(page);
  await page
    .getByLabel("Import library folder")
    .setInputFiles(makeLibrary({ tamper: true }));
  await expect(page.getByText(/failed its integrity check/)).toBeVisible();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".question-row")).toHaveCount(0);
});

test("a folder without a manifest explains what to choose", async ({
  page,
}) => {
  await page.goto("/");
  await openMaintenance(page);
  await page
    .getByLabel("Import library folder")
    .setInputFiles(makeLibrary({ noManifest: true }));
  await expect(page.getByText(/no manifest\.json/)).toBeVisible();
});
