import { expect, test, type Page } from "@playwright/test";
import { enterExpression, expression } from "./math-input";

async function openOfflineCalculator(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Section", exact: true })
    .getByRole("button", { name: "Math", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
}

test("percent entry inserts percent-of and evaluates without modulo semantics", async ({
  page,
}) => {
  await openOfflineCalculator(page);
  await expression(page, 1).focus();
  await page.keyboard.type("20");
  await page.keyboard.press("Shift+Digit5");
  await page.keyboard.type("50");
  const host = expression(page, 1).locator(
    "xpath=ancestor::span[contains(@class,'calc-structural-input')]",
  );
  await expect.poll(() => host.getAttribute("data-source")).toBe("20*0.01*50");
  await expect(page.locator(".calc-numeric-result").first()).toContainText(
    "10",
  );
  await expect(host).toHaveAttribute("data-latex", /\\%\\operatorname\{of\}/);
});

test("typing nthroot creates an editable indexed radical", async ({ page }) => {
  await openOfflineCalculator(page);
  await expression(page, 1).focus();
  await page.keyboard.type("nthroot");
  await page.keyboard.type("3");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("27");
  const host = expression(page, 1).locator(
    "xpath=ancestor::span[contains(@class,'calc-structural-input')]",
  );
  await expect(host).toHaveAttribute("data-latex", /\\sqrt\[3\]\{27\}/);
  await expect.poll(() => host.getAttribute("data-source")).toBe("cbrt(27)");
  await expect(page.locator(".calc-numeric-result").first()).toContainText("3");

  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("8");
  await expect.poll(() => host.getAttribute("data-source")).toBe("cbrt(8)");
  await expect(page.locator(".calc-numeric-result").first()).toContainText("2");
});

test("list statistics render scalar and five-number-summary results", async ({
  page,
}) => {
  await openOfflineCalculator(page);
  await enterExpression(page, 1, "mean([-2,1.5,4.5])");
  await expect(page.locator(".calc-numeric-result").first()).toContainText(
    "1.333333333",
  );
  await page.keyboard.press("Enter");
  await enterExpression(page, 2, "stats([1,2,3,4,5])");
  await expect(page.locator(".calc-list-result")).toContainText(
    "[1, 1.5, 3, 4.5, 5]",
  );
});
