import { test, expect } from "@playwright/test";
// Known question content for these interaction tests, independent of sampling.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});

test("contextual practice tools preserve drafts, calculator state and keyboard flow", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await expect(page.locator(".question-row")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Skill", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("math");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Finish session", exact: true }),
  ).not.toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await page.getByRole("radio").first().check();
  await page.keyboard.press("b");
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await page.getByLabel("First number").fill("6");
  await page.getByLabel("Second number").fill("7");
  await page.getByLabel("Operation").selectOption("×");
  await expect(page.locator(".calculator-result")).toHaveText("42");
  await page.getByRole("button", { name: "Open question overview" }).click();
  await page
    .getByRole("button", { name: "Go to question 2", exact: true })
    .click();
  await expect(page.locator(".calculator-result")).toHaveText("42");
  await page.getByRole("button", { name: "Open question overview" }).click();
  await page
    .getByRole("button", { name: "Go to question 1", exact: true })
    .click();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page.getByLabel("Show timer", { exact: true }).check();
  await page.getByRole("button", { name: "Pause timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume timer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume timer", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice tools" }),
  ).toBeFocused();
  await expect(page.getByLabel("Time on this question")).toBeVisible();
  await page.getByRole("button", { name: "Close calculator" }).click();
  await page.getByRole("article").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next question" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your numeric answer")).toBeVisible();
  await page.getByLabel("Your numeric answer").fill("28");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("practice-test protection persists and active overrides require a session confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Protect unused practice-test questions"),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Export full backup" }),
  ).toBeVisible();
  await page.getByLabel("Protect unused practice-test questions").uncheck();
  await page.reload();
  await page.getByText("Refine selection", { exact: true }).click();
  await expect(
    page.getByLabel("Protect practice-test questions", { exact: true }),
  ).not.toBeChecked();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(
    page.getByRole("button", { name: "Start practice" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(
    page.getByRole("button", { name: "Practice tools" }),
  ).toBeVisible();
});
