import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Four small original PDFs in the export's layout (see scripts/make_synthetic_export.py),
// two questions each. They contain no third-party question material.
const fixtures: Record<string, string> = JSON.parse(
  readFileSync("tests/fixtures/synthetic-exports.json", "utf8"),
);

function writeExports(names = Object.keys(fixtures)) {
  const dir = mkdtempSync(join(tmpdir(), "sat-study-pdf-"));
  return names.map((name) => {
    const path = join(dir, name);
    writeFileSync(path, Buffer.from(fixtures[name], "base64"));
    return path;
  });
}

async function openPreparation(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
}

test("PDF exports are prepared in the browser, practised offline, and hide the answer highlight", async ({
  page,
  context,
}) => {
  const remote: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      !url.startsWith("http://127.0.0.1:4318") &&
      !url.startsWith("data:") &&
      !url.startsWith("blob:")
    ) {
      remote.push(url);
      await route.abort();
    } else await route.continue();
  });
  await openPreparation(page);
  await page.getByLabel("PDF export files").setInputFiles(writeExports());
  await expect(page.getByLabel("Chosen exports")).toContainText(
    "✓ math_active.pdf",
  );
  const prepare = page.getByRole("button", { name: "Add questions" });
  // Nothing needs to be decided: the active and inactive files are told apart
  // from their contents.
  await expect(prepare).toBeEnabled();
  await prepare.click();
  await expect(page.getByText("Added 8 questions.")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(/4 are marked active and stay hidden/)).toBeVisible();
  expect(remote).toEqual([]);

  // Active questions stay hidden by default; the inactive ones are practised.
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".question-row")).toHaveCount(4);
  await page.locator(".question-row-main").first().click();
  const image = page.getByLabel("Original PDF question").locator("img").first();
  await expect(image).toBeVisible();
  await expect(page.getByLabel("Original PDF explanation")).toHaveCount(0);
  expect(
    await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1160);
  // The highlight annotation over the correct option must not be drawn, and
  // glyph edges must stay grey (no colour fringing that could look like one).
  const yellow = await image.evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] < 150) count++;
    return count;
  });
  expect(yellow).toBe(0);

  // The prepared library is stored locally and survives a reload.
  await page.reload();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".question-row")).toHaveCount(4);
});

test("preparation needs all four exports", async ({ page }) => {
  await openPreparation(page);
  await page
    .getByLabel("PDF export files")
    .setInputFiles(writeExports(["math_active.pdf", "math_inactive.pdf"]));
  await expect(page.getByLabel("Chosen exports")).toContainText(
    "read_write_inactive.pdf (not chosen)",
  );
  await expect(
    page.getByRole("button", { name: "Add questions" }),
  ).toBeDisabled();
});
