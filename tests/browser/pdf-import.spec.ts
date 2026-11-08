import { expect, test } from "@playwright/test";

/**
 * Adds real question PDFs through the Add-PDFs pop-up. The PDFs carry the portal's
 * access codes, so none is in this repository: point PORTAL_TEST_PDFS at them
 * (paths separated by commas) to run this, otherwise it is skipped, like the other
 * checks that need private files.
 *
 *   PORTAL_TEST_PDFS="C:/pdfs/SAT.pdf,C:/pdfs/PAA.pdf,C:/pdfs/TSI.pdf" npm run test:e2e -- pdf-import
 */
const paths = (process.env.PORTAL_TEST_PDFS ?? "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

test.skip(!paths.length, "PORTAL_TEST_PDFS is not set");

test("PDFs with any file names are sorted by test and added", async ({
  page,
}) => {
  test.setTimeout(30 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Add PDFs" }).click();
  const dialog = page.getByRole("dialog", { name: "Add your question PDFs" });
  await dialog.getByLabel("PDF export files").setInputFiles(paths);
  // Every PDF is looked at before the button opens.
  await expect(dialog.getByText("Checking…")).toHaveCount(0, {
    timeout: 5 * 60_000,
  });
  await expect(
    dialog.getByRole("button", { name: "Add questions" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Add questions" }).click();
  await expect(dialog.getByText(/Added \d+ questions\./).first()).toBeVisible({
    timeout: 25 * 60_000,
  });
  await expect(dialog.getByText(/Nothing was added/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
