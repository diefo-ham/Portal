import { expect, test, type Page } from "@playwright/test";
import { enterExpression, expectExpression } from "./math-input";

async function startMathPractice(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
  await page.getByRole("button", { name: "Start practice" }).click();
}

test("Hold Shift transiently inverts Calculator without changing manual state", async ({
  page,
}) => {
  await startMathPractice(page);
  const article = page.getByRole("article");
  const toggle = page.getByRole("button", {
    name: "Calculator",
    exact: true,
  });
  const panel = page.locator(".calculator-sheet");

  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute(
    "title",
    /Hold Shift to peek at Calculator/,
  );
  await article.focus();
  await page.keyboard.down("Shift");
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByText("Release Shift to close")).toBeVisible();

  // A repeated keydown must not toggle the transient state back.
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        code: "ShiftLeft",
        repeat: true,
        bubbles: true,
      }),
    ),
  );
  await expect(panel).toBeVisible();
  await page.keyboard.up("Shift");
  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Hold Shift to temporarily hide")).toBeVisible();
  await enterExpression(page, 1, "6+7");
  await article.focus();
  await page.keyboard.down("Shift");
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.up("Shift");
  await expect(panel).toBeVisible();
  await expectExpression(page, 1, "6+7");

  await page.getByRole("button", { name: "Close calculator" }).click();
  await expect(panel).toHaveCount(0);
  await toggle.click();
  await expectExpression(page, 1, "6+7");
  await expect(
    page.getByRole("button", { name: "Fit", exact: true }),
  ).toHaveCount(0);
});

test("Shift stays native in calculator editing and blur clears an inversion", async ({
  page,
}) => {
  await startMathPractice(page);
  const article = page.getByRole("article");
  const toggle = page.getByRole("button", {
    name: "Calculator",
    exact: true,
  });
  const panel = page.locator(".calculator-sheet");

  await toggle.click();
  await enterExpression(page, 1, "x+1");
  await page.keyboard.down("Shift");
  await expect(panel).toBeVisible();
  await page.keyboard.up("Shift");
  await expectExpression(page, 1, "x+1");

  await article.focus();
  await page.keyboard.down("Shift");
  await expect(panel).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(panel).toBeVisible();
  await page.keyboard.up("Shift");
  await expect(panel).toBeVisible();

  await page.getByRole("button", { name: "Close calculator" }).click();
  await article.focus();
  await page.keyboard.down("Shift");
  await expect(panel).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(panel).toHaveCount(0);
  await page.keyboard.up("Shift");
  await expect(panel).toHaveCount(0);

  // Right Shift follows the same transient path.
  await article.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        code: "ShiftRight",
        bubbles: true,
      }),
    ),
  );
  await expect(panel).toBeVisible();
  await article.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Shift",
        code: "ShiftRight",
        bubbles: true,
      }),
    ),
  );
  await expect(panel).toHaveCount(0);

  await page.getByRole("button", { name: "Practice tools" }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.down("Shift");
  await expect(panel).toHaveCount(0);
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Close panel" }).click();
});
