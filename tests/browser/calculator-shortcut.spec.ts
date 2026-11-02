import { expect, test, type Page } from "@playwright/test";
import { enterExpression, expectExpression } from "./math-input";

/** Shift+Backslash. Naming the produced "|" key keeps text entry identical on Linux and Windows. */
async function typePipe(page: Page) {
  await page.keyboard.down("Shift");
  await page.keyboard.press("|");
  await page.keyboard.up("Shift");
}

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

test("plain Backslash persistently toggles Calculator without hold behavior", async ({
  page,
}) => {
  await startMathPractice(page);
  const article = page.getByRole("article");
  const toggle = page.getByRole("button", { name: "Calculator", exact: true });
  const panel = page.locator(".calculator-sheet");

  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("title", /\\ toggles/);
  await article.focus();
  await page.keyboard.down("\\");
  await expect(panel).toBeVisible();
  await page.keyboard.up("\\");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("\\ Toggle calculator")).toBeVisible();

  const repeatWasAllowed = await article.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "\\",
        code: "Backslash",
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(repeatWasAllowed).toBe(false);
  await expect(panel).toBeVisible();

  await page.keyboard.press("Backslash");
  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await enterExpression(page, 1, "6+7");
  await page.getByRole("button", { name: "Close calculator" }).click();
  await toggle.click();
  await expectExpression(page, 1, "6+7");
});

test("Backslash preserves editable focus while Shift+Backslash and modifiers remain normal", async ({
  page,
}) => {
  await startMathPractice(page);
  const article = page.getByRole("article");
  const panel = page.locator(".calculator-sheet");
  const answer = page.getByLabel("Your numeric answer");
  for (let index = 1; index < 5 && !(await answer.count()); index++) {
    await article.focus();
    await page.keyboard.press("ArrowRight");
  }
  await expect(answer).toBeVisible();
  await answer.fill("12");
  // Keys go to whatever has focus, so make sure it is the answer before typing.
  await answer.focus();
  await expect(answer).toBeFocused();
  await answer.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(1, 1),
  );
  await typePipe(page);
  await expect(answer).toHaveValue("1|2");
  await expect(panel).toHaveCount(0);

  await answer.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(2, 2),
  );
  await page.keyboard.press("Backslash");
  await expect(panel).toBeVisible();
  await expect(answer).toBeFocused();
  await expect(answer).toHaveValue("1|2");
  expect(
    await answer.evaluate((input: HTMLInputElement) => input.selectionStart),
  ).toBe(2);
  await page.keyboard.press("Backslash");
  await expect(panel).toHaveCount(0);
  await expect(answer).toBeFocused();
  await expect(answer).toHaveValue("1|2");

  await page.keyboard.press("Backslash");
  await enterExpression(page, 1, "x+1");
  await page.keyboard.press("Enter");
  const absoluteExpression = page.getByRole("textbox", {
    name: "Expression 2",
    exact: true,
  });
  await expect(absoluteExpression).toBeFocused();
  await typePipe(page);
  await expect
    .poll(() =>
      absoluteExpression
        .locator(
          "xpath=ancestor::span[contains(@class,'calc-structural-input')]",
        )
        .getAttribute("data-source"),
    )
    .toContain("|");
  await page.keyboard.press("KeyX");
  await expect
    .poll(() =>
      absoluteExpression
        .locator(
          "xpath=ancestor::span[contains(@class,'calc-structural-input')]",
        )
        .getAttribute("data-source"),
    )
    .toContain("x");
  await typePipe(page);
  await expect(panel).toBeVisible();
  await expectExpression(page, 2, "|x|");

  await article.focus();
  for (const modifiers of [
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
    { shiftKey: true },
  ]) {
    const allowed = await article.evaluate(
      (element, init) =>
        element.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: init.shiftKey ? "|" : "\\",
            code: "Backslash",
            ...init,
            bubbles: true,
            cancelable: true,
          }),
        ),
      modifiers,
    );
    expect(allowed).toBe(true);
    await expect(panel).toBeVisible();
  }
});

test("Backslash does not toggle through a Practice modal", async ({ page }) => {
  await startMathPractice(page);
  const panel = page.locator(".calculator-sheet");
  await page.getByRole("button", { name: "Practice tools" }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.press("Backslash");
  await expect(panel).toHaveCount(0);
});
