import { test, expect } from "@playwright/test";
import { enterExpression, expectExpression } from "./math-input";

test("contextual Space and arrow navigation respect focused controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    nav.getByRole("button", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("article")).toBeFocused();
  await expect(page.getByRole("button", { name: /note/i })).toHaveCount(0);
  await page.keyboard.press("2");
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await page.keyboard.press("Space");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await page.keyboard.press("Space"); // Native button activation on focused Next.
  await expect(page.getByLabel("Your numeric answer")).toBeVisible();
  await page.getByLabel("Your numeric answer").fill("28");
  await page.keyboard.press("ArrowLeft"); // Caret movement, not question navigation.
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 2/);
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Your numeric answer")).toHaveValue("2 8");
  await expect(page.getByText("Correct. Nicely done.")).toHaveCount(0);
  await page.getByLabel("Your numeric answer").fill("28");
  await page.getByRole("article").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 1/);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Your numeric answer")).toHaveValue("28");
  await page.keyboard.press("Space");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await page.keyboard.press("ArrowRight"); // Works on the focused Next button, too.
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 3/);
  for (const index of [4, 5]) {
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("button", { name: "Open question overview" }),
    ).toHaveText(`Question ${index} of 5`);
  }
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("ArrowRight"); // Radio group navigation stays native.
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 5/);
  await page.keyboard.press("Space");
  await expect(page.getByText("Correct. Nicely done.")).toHaveCount(0);
  await page.getByRole("button", { name: "Practice tools" }).click();
  await expect(page.getByRole("button", { name: /note/i })).toHaveCount(0);
  await page.getByLabel("Show timer", { exact: true }).focus();
  const timerWasVisible = await page
    .getByLabel("Show timer", { exact: true })
    .isChecked();
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.getByLabel("Show timer", { exact: true }).isChecked())
    .toBe(!timerWasVisible);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.getByLabel("Show timer", { exact: true }).isChecked())
    .toBe(timerWasVisible);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await enterExpression(page, 1, "6+7");
  await page.keyboard.press("ArrowLeft");
  await expectExpression(page, 1, "6+7");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 5/);
});
