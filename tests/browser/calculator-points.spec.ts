import { expect, test, type Page } from "@playwright/test";
import { enterExpression } from "./math-input";
import { loadSample } from "./seed";

async function open(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await loadSample(page);
  await page
    .getByRole("group", { name: "Section", exact: true })
    .getByRole("button", { name: "Math", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
}

test("a list of points shows chips, and mean gives one point", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "a=[(3,4),(4,3)]");
  await enterExpression(page, 2, "mean(a)");
  const chips = page.locator(".calc-point-result");
  await expect(chips.nth(0).locator(".calc-point-chip")).toHaveText([
    "(3, 4)",
    "(4, 3)",
  ]);
  await expect(chips.nth(1).locator(".calc-point-chip")).toHaveText([
    "(3.5, 3.5)",
  ]);
  await enterExpression(page, 3, "distance((0,0),(3,4))");
  await expect(page.locator(".calc-entry").nth(2)).toContainText("5");
  await enterExpression(page, 4, "midpoint((0,0),(3,4))");
  await expect(
    page.locator(".calc-point-result").nth(2).locator(".calc-point-chip"),
  ).toHaveText(["(1.5, 2)"]);
});

test("a subscripted nonlinear system solves like the reference calculator regression", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "x^2+y+7=7");
  await enterExpression(page, 2, "20x+100-y=0");
  await enterExpression(page, 3, "[x_1^2+y_1+7,20x_1+100-y_1]~[7,0]");
  const entry = page.locator(".calc-entry").nth(2);
  await expect(entry).not.toContainText("exceeds supported");
  await expect(entry).toContainText("RMSE = 0");
  await expect(entry).toContainText("-100");
});
