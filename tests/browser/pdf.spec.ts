import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sample from "../../src/data/synthetic.json" with { type: "json" };

test("version-one study data survives the image-store migration", async ({
  page,
}) => {
  await page.goto("/migration-seed");
  await page.evaluate(async (questions) => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open("sat-study-local", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("state");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const tx = r.result.transaction("state", "readwrite");
        tx.objectStore("state").put(
          {
            version: 1,
            questions,
            attempts: [],
            sessions: [],
            imports: [],
            annotations: {
              "demo-m01": {
                bookmarked: true,
                note: "Existing note from the MVP",
              },
            },
          },
          "current",
        );
        tx.oncomplete = () => {
          r.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, sample.questions);
  await page.goto("/");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".question-row")).toHaveCount(10);
  await page.locator(".question-row").first().click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  await expect(page.getByLabel("My notes")).toHaveValue(
    "Existing note from the MVP",
  );
});

test("PDF image storage, spoiler separation, portable backup and restore", async ({
  page,
}) => {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP0kAAAAASUVORK5CYII=",
    "base64",
  );
  const hash = createHash("sha256").update(bytes).digest("hex");
  const panel = {
    src: `asset:${hash}.webp`,
    alt: "Synthetic original layout",
    width: 1,
    height: 1,
  };
  const question = {
    id: "pdf-synthetic",
    sourceId: "synthetic",
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
        { filename: "synthetic.pdf", sha256: "a".repeat(64), pages: [1] },
      ],
    },
  };
  const questions = JSON.stringify({ schemaVersion: 1, questions: [question] });
  const revision = createHash("sha256").update(questions).digest("hex");
  let assetRequests = 0;
  await page.route("**/local-library/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("manifest.json"))
      await route.fulfill({
        json: {
          format: "sat-study-local-library-v1",
          revision,
          questionCount: 1,
          assets: [hash + ".webp"],
          label: "Synthetic PDF library",
        },
      });
    else if (url.endsWith("questions.json"))
      await route.fulfill({ body: questions, contentType: "application/json" });
    else {
      assetRequests++;
      await route.fulfill({ body: bytes, contentType: "image/png" });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".question-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByLabel("Original PDF question")).toBeVisible();
  await expect(page.getByLabel("Original PDF explanation")).toHaveCount(0);
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await expect(page.getByLabel("Original PDF explanation")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  expect(assetRequests).toBe(1);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Library & maintenance", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const path = await (await download).path();
  const backup = JSON.parse(await readFile(path!, "utf8"));
  expect(backup.data.questions[0].document.question[0].src).toMatch(
    /^data:image\/png;base64,/,
  );
  await page.getByLabel("Restore backup JSON").setInputFiles(path!);
  await page
    .getByRole("button", { name: "Replace with backup", exact: true })
    .click();
  await expect(
    page.getByText("Backup restored. Saved session timers are paused."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Resume practice" }).click();
  await expect(
    page.getByLabel("Original PDF question").locator("img"),
  ).toBeVisible();
});
