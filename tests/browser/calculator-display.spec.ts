import { test, expect } from "@playwright/test";
import { enterExpression } from "./math-input";
import { loadSample } from "./seed";

async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await loadSample(page);
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
}

test("one button switches between radians and degrees", async ({ page }) => {
  await open(page);
  await enterExpression(page, 1, "sin(90)");
  const toggle = page.getByRole("button", { name: /Angle unit: radians/ });
  await expect(toggle).toHaveText(/Radians/);
  await expect(page.locator(".calc-numeric-result").first()).not.toHaveText(
    "= 1",
  );
  await toggle.click();
  const back = page.getByRole("button", { name: /Angle unit: degrees/ });
  await expect(back).toHaveText(/Degrees/);
  await expect(page.locator(".calc-numeric-result").first()).toHaveText("= 1");
  await back.click();
  await expect(
    page.getByRole("button", { name: /Angle unit: radians/ }),
  ).toBeVisible();
});

test("a long list shows its ends and opens up on request", async ({ page }) => {
  await open(page);
  await enterExpression(page, 1, "n=[-10...10]");
  const result = page.locator(".calc-list-result");
  await expect(result).toHaveText("[-10, -9, -8, -7, -6, …, 8, 9, 10]");
  await page.getByRole("button", { name: "Show all 21 values" }).click();
  await expect(result).toHaveText(
    "[-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  );
  await page.getByRole("button", { name: "Show fewer" }).click();
  await expect(result).toContainText("…");
  // Short lists are always shown in full.
  await enterExpression(page, 1, "n=[1,2,3]");
  await expect(result).toHaveText("[1, 2, 3]");
  await expect(page.getByRole("button", { name: /Show all/ })).toHaveCount(0);
});
