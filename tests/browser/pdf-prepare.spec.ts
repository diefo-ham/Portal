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

/** The pop-up opened from the empty Home screen, where the PDFs are dropped. */
async function openPreparation(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Add your question PDFs" }).click();
  return page.getByRole("dialog", { name: "Add your question PDFs" });
}

/** Drops files onto the pop-up as a person would, with a real DataTransfer. */
async function dropFiles(
  dialog: ReturnType<Page["getByRole"]>,
  files: { name: string; base64: string; type?: string }[],
) {
  await dialog.evaluate((element, items) => {
    const transfer = new DataTransfer();
    for (const item of items) {
      const bytes = Uint8Array.from(atob(item.base64), (c) => c.charCodeAt(0));
      transfer.items.add(
        new File([bytes], item.name, { type: item.type ?? "application/pdf" }),
      );
    }
    for (const type of ["dragenter", "dragover", "drop"])
      element.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
  }, files);
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
  const dialog = await openPreparation(page);
  await dialog.getByLabel("PDF export files").setInputFiles(writeExports());
  await expect(dialog.getByLabel("Chosen exports")).toContainText(
    "math_active.pdf",
  );
  await expect(dialog.getByLabel("Chosen exports")).toContainText(
    "SAT · Math · active",
  );
  const prepare = dialog.getByRole("button", { name: "Add questions" });
  // Nothing needs to be decided: the active and inactive files are told apart
  // from their contents.
  await expect(prepare).toBeEnabled();
  await prepare.click();
  await expect(dialog.getByText("Added 8 questions.")).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    dialog.getByText(/4 are marked active and stay hidden/),
  ).toBeVisible();
  expect(remote).toEqual([]);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();

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
  const dialog = await openPreparation(page);
  await dialog
    .getByLabel("PDF export files")
    .setInputFiles(writeExports(["math_active.pdf", "math_inactive.pdf"]));
  await expect(dialog).toContainText(
    "The SAT exports are read together. Still needed: read_write_inactive.pdf",
  );
  await expect(
    dialog.getByRole("button", { name: "Add questions" }),
  ).toBeDisabled();
});

test("dropping every PDF at once sorts the SAT exports and sets the rest aside", async ({
  page,
}) => {
  const dialog = await openPreparation(page);
  await dropFiles(dialog, [
    ...Object.entries(fixtures).map(([name, base64]) => ({ name, base64 })),
    // An SAT export under another name is not a PAA export: it is set aside.
    { name: "carta.pdf", base64: fixtures["math_active.pdf"] },
    { name: "notas.txt", base64: btoa("no es un PDF"), type: "text/plain" },
  ]);
  const chosen = dialog.getByLabel("Chosen exports");
  await expect(chosen).toContainText("read_write_inactive.pdf");
  await expect(chosen).toContainText("SAT · Reading & Writing · inactive");
  await expect(chosen).toContainText("carta.pdf");
  await expect(dialog).toContainText(
    "Ignored, because they are not PDFs: notas.txt",
  );
  await dialog.getByRole("button", { name: "Add questions" }).click();
  await expect(dialog.getByText("Added 8 questions.")).toBeVisible({
    timeout: 90_000,
  });
  await expect(dialog).toContainText(
    "None of these PDFs is a question export, so nothing was added. Set aside: carta.pdf",
  );
});

test("Escape closes the pop-up and returns focus to the button", async ({
  page,
}) => {
  const dialog = await openPreparation(page);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Add your question PDFs" }),
  ).toBeFocused();
});

test("Settings lists each PDF and removes one, keeping the others", async ({
  page,
}) => {
  const dialog = await openPreparation(page);
  await dialog.getByLabel("PDF export files").setInputFiles(writeExports());
  await dialog.getByRole("button", { name: "Add questions" }).click();
  await expect(dialog.getByText("Added 8 questions.")).toBeVisible({
    timeout: 90_000,
  });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const list = page.getByRole("list", { name: "Your question PDFs" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(
    list.getByRole("listitem").filter({ hasText: "math_active.pdf" }),
  ).toContainText("2 questions · 2 active");
  await page.getByRole("button", { name: "Remove math_active.pdf" }).click();
  await page
    .getByRole("dialog", { name: "Remove math_active.pdf?" })
    .getByRole("button", { name: "Remove PDF" })
    .click();
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("6 questions are stored")).toBeVisible();
  await expect(page.getByText("PDF removed.")).toBeVisible();
});
