import { test, expect, type Page } from "@playwright/test";
import { loadSample } from "./seed";

// Deleting a session keeps its answers by default; a Settings option removes them too.

async function answerOneAndFinish(page: Page) {
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("1");
  await page.getByRole("button", { name: "Start practice" }).click();
  const numeric = page.getByRole("textbox", { name: "Your numeric answer" });
  await expect(
    page.getByRole("button", { name: "Check answer" }),
  ).toBeVisible();
  if (await numeric.isVisible()) await numeric.fill("1");
  else await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Review session →" }).click();
  await page.getByRole("button", { name: "← Back to practice" }).click();
}

async function deleteTheSession(page: Page) {
  await page
    .getByRole("button", { name: /^Session actions for/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Delete session" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete session" })
    .click();
}

const stored = (page: Page) =>
  page.getByText(/^\d+ questions · \d+ attempts · \d+ bookmarks$/);

test("by default a deleted session leaves its answers in the study history", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page);
  await answerOneAndFinish(page);
  await expect(
    page
      .getByRole("dialog", { includeHidden: true })
      .getByText(
        "Your answers and bookmarks will stay in your study history.",
        { exact: false },
      )
      .first(),
  ).toBeAttached();
  await deleteTheSession(page);
  await expect(
    page.getByRole("heading", { name: "Your sessions" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(stored(page)).toContainText("1 attempts");
});

test("with the setting on, deleting a session removes its answers too", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const option = page.getByLabel("Deleting a session also removes its answers");
  await expect(option).not.toBeChecked();
  await option.check();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(option).toBeChecked();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await answerOneAndFinish(page);
  await expect(
    page
      .getByRole("dialog", { includeHidden: true })
      .getByText("Its answers will also be removed from your progress", {
        exact: false,
      })
      .first(),
  ).toBeAttached();
  await deleteTheSession(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(stored(page)).toContainText("0 attempts");
});

test("the same option is in the PAA settings, in Spanish", async ({ page }) => {
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(
    page.getByLabel("Al eliminar una sesión, también se quitan sus respuestas"),
  ).not.toBeChecked();
});
