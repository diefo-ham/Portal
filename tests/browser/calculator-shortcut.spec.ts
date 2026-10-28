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

test("plain Backslash transiently inverts Calculator without changing manual state", async ({
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
    /Hold \\ to peek at Calculator/,
  );
  await article.focus();
  await page.keyboard.down("\\");
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByText("Release \\ to close")).toBeVisible();

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
  await page.keyboard.up("\\");
  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Hold \\ to temporarily hide")).toBeVisible();
  await enterExpression(page, 1, "6+7");
  await article.focus();
  await page.keyboard.down("\\");
  await expect(panel).toHaveCSS("opacity", "0");
  await expect(panel).toHaveCSS("pointer-events", "none");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.up("\\");
  await expect(panel).toBeVisible();
  await expectExpression(page, 1, "6+7");

  await page.getByRole("button", { name: "Close calculator" }).click();
  await expect(panel).toHaveCount(0);
  await toggle.click();
  await expectExpression(page, 1, "6+7");
});

test("Backslash preserves editable focus while modified Backslash remains normal input", async ({
  page,
}) => {
  await startMathPractice(page);
  const article = page.getByRole("article");
  const toggle = page.getByRole("button", {
    name: "Calculator",
    exact: true,
  });
  const panel = page.locator(".calculator-sheet");

  // A temporary reveal must not steal an existing input caret.
  const answer = page.getByLabel("Your numeric answer");
  for (let index = 1; index < 5 && !(await answer.count()); index++) {
    await article.focus();
    await page.keyboard.press("ArrowRight");
  }
  await expect(answer).toBeVisible();
  await answer.fill("128");
  await answer.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(1, 1),
  );
  await page.keyboard.down("\\");
  await expect(panel).toBeVisible();
  await expect(answer).toBeFocused();
  await expect(answer).toHaveValue("128");
  expect(
    await answer.evaluate((input: HTMLInputElement) => input.selectionStart),
  ).toBe(1);
  await page.keyboard.up("\\");
  await expect(panel).toHaveCount(0);
  await expect(answer).toBeFocused();
  expect(
    await answer.evaluate((input: HTMLInputElement) => input.selectionStart),
  ).toBe(1);

  await toggle.click();
  await enterExpression(page, 1, "x+1");
  await page.evaluate(() =>
    document.activeElement?.setAttribute("data-shortcut-focus", "true"),
  );
  await page.keyboard.down("\\");
  await expect(panel).toHaveCSS("opacity", "0");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.up("\\");
  await expect(panel).toBeVisible();
  await expectExpression(page, 1, "x+1");
  await expect(page.locator('[data-shortcut-focus="true"]')).toBeFocused();

  // Shift+Backslash remains ordinary pipe input for absolute values.
  await page.keyboard.press("Enter");
  const absoluteExpression = page.getByRole("textbox", {
    name: "Expression 2",
    exact: true,
  });
  await expect(absoluteExpression).toBeFocused();
  await page.keyboard.press("Shift+Backslash");
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
  await page.keyboard.press("Shift+Backslash");
  await expect(panel).toBeVisible();
  await expectExpression(page, 2, "|x|");

  await article.focus();
  for (const modifiers of [
    { ctrlKey: true },
    { altKey: true },
    { metaKey: true },
  ]) {
    const allowed = await article.evaluate(
      (element, init) =>
        element.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "\\",
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

  await page.keyboard.down("Shift");
  await expect(panel).toBeVisible();
  await page.keyboard.up("Shift");
  await expect(panel).toBeVisible();
});

test("blur and modal safeguards cannot leave a Backslash inversion stuck", async ({
  page,
}) => {
  await startMathPractice(page);
  const article = page.getByRole("article");
  const panel = page.locator(".calculator-sheet");

  await article.focus();
  await page.keyboard.down("\\");
  await expect(panel).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(panel).toHaveCount(0);
  await page.keyboard.up("\\");

  await page.getByRole("button", { name: "Practice tools" }).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await page.keyboard.down("\\");
  await expect(panel).toHaveCount(0);
  await page.keyboard.up("\\");
  await page.getByRole("button", { name: "Close panel" }).click();
});
