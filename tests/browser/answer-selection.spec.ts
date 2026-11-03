import { expect, test } from "@playwright/test";
import { loadSample } from "./seed";

test("choice selection toggles while editable, persists, and locks after submission", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await loadSample(page);
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();

  const choiceA = page.getByRole("radio", { name: "A" });
  const choiceB = page.getByRole("radio", { name: "B" });
  await expect(
    page.getByRole("button", { name: /Eliminate choice/ }),
  ).toHaveCount(0);
  await expect(page.locator(".answer-choice.eliminated")).toHaveCount(0);

  await choiceA.click();
  await expect(choiceA).toBeChecked();
  await choiceA.click();
  await expect(choiceA).not.toBeChecked();

  await choiceA.click();
  await choiceB.click();
  await expect(choiceA).not.toBeChecked();
  await expect(choiceB).toBeChecked();
  await choiceB.click();
  await expect(choiceB).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Check answer" }),
  ).toBeDisabled();

  await page.keyboard.press("b");
  await expect(choiceB).toBeChecked();
  await page.keyboard.press("b");
  await expect(choiceB).not.toBeChecked();
  await page.keyboard.press("a");
  await page.keyboard.press("b");
  await expect(choiceA).not.toBeChecked();
  await expect(choiceB).toBeChecked();

  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(choiceB).toBeChecked();
  await choiceB.click();
  await expect(choiceB).not.toBeChecked();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(choiceB).not.toBeChecked();

  await choiceB.click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await expect(choiceB).toBeChecked();
  await expect(choiceB).toBeDisabled();
  await choiceB.click({ force: true });
  await expect(choiceB).toBeChecked();
});
