import { expect, type Page } from "@playwright/test";
import { latexToText, textToLatex } from "../../src/calculator/latex";

export const expression = (page: Page, n: number) =>
  page.getByRole("textbox", { name: `Expression ${n}`, exact: true });

/** Structural fields use a hidden textarea for keyboard events, not a text value. */
export async function enterExpression(page: Page, n: number, text: string) {
  const input = expression(page, n);
  await input.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await input.evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  }, text);
}

export async function expectExpression(page: Page, n: number, text: string) {
  await expect
    .poll(async () =>
      (
        await expression(page, n)
          .locator(
            "xpath=ancestor::span[contains(@class,'calc-structural-input')]",
          )
          .getAttribute("data-source")
      )?.replace(/[()\s]/g, ""),
    )
    .toBe(latexToText(textToLatex(text)).replace(/[()\s]/g, ""));
}
