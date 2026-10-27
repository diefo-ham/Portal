import { expect, test, type Page } from "@playwright/test";

async function sessionCount(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sat-study-local");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const request = database
          .transaction("state")
          .objectStore("state")
          .get("current");
        request.onsuccess = () => resolve(request.result.sessions.length);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
});

test("session size is numeric, bounded, and adapts to the filtered pool", async ({
  page,
}) => {
  const size = page.getByRole("textbox", { name: "Session size" });
  const start = page.getByRole("button", { name: "Start practice" });
  await expect(size).toHaveValue("10");
  await expect(page.getByText("Max 10", { exact: true })).toBeVisible();

  await size.fill("0");
  await expect(start).toBeDisabled();
  await size.fill("11");
  await expect(start).toBeDisabled();
  await size.fill("9");
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await expect(page.getByText("Max 5", { exact: true })).toBeVisible();
  await expect(size).toHaveValue("9");
  await expect(start).toBeDisabled();
  await size.fill("");
  await expect(start).toBeDisabled();
  await size.fill("3");
  await start.click();
  await expect(page.getByLabel("Open question overview")).toContainText("of 3");
});

test("header order, concise help, and ordinary overlays dismiss outside", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const labels = await nav
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map(
        (button) =>
          button.getAttribute("aria-label") || button.textContent?.trim(),
      ),
    );
  expect(labels).toEqual([
    "Practice",
    "Review",
    "Browse",
    "Help and keyboard shortcuts",
    "Settings",
  ]);
  await expect(
    nav.getByRole("button", { name: "Help and keyboard shortcuts" }),
  ).toHaveText("Help");

  await nav
    .getByRole("button", { name: "Help and keyboard shortcuts" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Practice and Browse");
  await expect(dialog).toContainText("unknown status");
  await expect(dialog).toContainText("latest recorded answer is incorrect");
  await dialog.dispatchEvent("click");
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: /Domain:/ }).click();
  await expect(page.locator(".multi-options")).toBeVisible();
  await page
    .getByRole("heading", { name: "What would you like to work on?" })
    .click();
  await expect(page.locator(".multi-options")).not.toBeVisible();

  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").dispatchEvent("click");
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await page.getByRole("button", { name: "Calculator" }).click();
  await page
    .locator("article.question-card")
    .click({ position: { x: 20, y: 20 } });
  await expect(page.getByLabel("Calculator panel")).toBeVisible();
});

test("Browse inspects and bookmarks individual questions without creating sessions", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toHaveCount(0);
  await expect(page.getByText("Your session is waiting.")).toHaveCount(0);
  expect(await sessionCount(page)).toBe(0);

  const firstBookmark = page.locator(".question-row > .bookmark").first();
  await firstBookmark.click();
  await expect(firstBookmark).toHaveAttribute("aria-pressed", "true");
  await page.locator(".question-row-main").first().click();
  await expect(page.getByLabel("Browse question 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove bookmark" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByLabel("Browse question 2")).toBeVisible();
  await page.getByRole("button", { name: "← Back to questions" }).click();
  await expect(
    page.getByRole("heading", { name: "Matching questions" }),
  ).toBeVisible();
  expect(await sessionCount(page)).toBe(0);
});
