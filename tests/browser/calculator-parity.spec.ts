import { test, expect, type Page } from "@playwright/test";
import { expression, enterExpression, expectExpression } from "./math-input";

async function openCalculator(page: Page) {
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

async function configured(page: Page) {
  await page.route("**/calculator-config.json", (route) =>
    route.fulfill({ json: { desmosApiKey: "test-key-only" } }),
  );
}

// Public API boundary mock, never a copy of Desmos implementation or live dependency.
const mockApi = `window.Desmos = { GraphingCalculator(element) {
  let state = {version: 11, expressions: {list: []}}, change = () => {};
  const input = document.createElement('textarea'); input.setAttribute('aria-label','Mock Desmos expression'); element.appendChild(input);
  input.addEventListener('input', () => { state = {version:11, expressions:{list:[{latex:input.value}]}}; change(); });
  return { getState: () => state, setState: value => {state=value;input.value=value.expressions?.list?.[0]?.latex || '';},
    observeEvent: (name, callback) => {change=callback;}, setBlank: () => {state={version:11, expressions:{list:[]}};input.value='';change();},
    focusFirstExpression: () => input.focus(), destroy: () => input.remove() };
} };`;

test("structural typing, fractions, roots, row deletion, table commands, and Clear", async ({
  page,
}) => {
  await openCalculator(page);
  await expect(expression(page, 1)).toBeFocused();
  await page.keyboard.type("sqrt81");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".calc-numeric-result")).toHaveText("= 9");
  await expect(page.locator(".dcg-mq-sqrt-prefix")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(expression(page, 2)).toBeFocused();
  await page.keyboard.type("1/2");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("+1/3");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".calc-numeric-result").last()).toHaveText(
    "= 0.8333333333",
  );
  await page.keyboard.press("Enter");
  await expect(expression(page, 3)).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(expression(page, 2)).toBeFocused();
  await expect(page.locator(".calc-structural-input")).toHaveCount(3);
  await expression(page, 3).focus();
  await page.keyboard.type("table");
  const table = page.getByRole("region", { name: "Data table 3", exact: true });
  await expect(table).toBeVisible();
  const cells = table.getByRole("textbox");
  await expect(cells.first()).toBeFocused();
  await cells.first().fill("1");
  await page.keyboard.press("Tab");
  await expect(cells.nth(1)).toBeFocused();
  await cells.nth(1).fill("4");
  await page.keyboard.press("Tab");
  await expect(cells.nth(2)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(cells.first()).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  await expect(cells.nth(1)).toBeFocused();
  await cells.nth(2).fill("2");
  await cells.nth(3).fill("7");
  await cells.nth(4).fill("3");
  await cells.nth(5).fill("10");
  await cells.nth(7).focus();
  await page.keyboard.press("Enter");
  await expect(expression(page, 4)).toBeFocused();
  await enterExpression(page, 4, "y_1~m*x_1+b");
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "b = 1 · m = 3",
  );
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Clear calculator confirmation" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(table).toBeVisible();
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Clear calculator confirmation" })
    .getByRole("button", { name: "Clear", exact: true })
    .click();
  await expect(page.locator(".calc-structural-input")).toHaveCount(1);
  await expectExpression(page, 1, "");
  await expect(page.locator(".calc-data-table")).toHaveCount(0);
  await expression(page, 1).focus();
  await page.keyboard.type("table");
  await page.locator(".calc-data-table input").first().focus();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".calc-data-table")).toHaveCount(0);
  await expect(expression(page, 1)).toBeFocused();
});

test("lists and table-linked regression syntax graph fits while Practice keys stay isolated", async ({
  page,
}) => {
  await openCalculator(page);
  await enterExpression(page, 1, "x_1=[1,2,3]");
  await page.keyboard.press("Enter");
  await enterExpression(page, 2, "y_1=[4,7,10]");
  await page.keyboard.press("Enter");
  await enterExpression(page, 3, "(x_1,y_1)");
  await expect(page.locator(".graph-data-point")).toHaveCount(3);
  await page.keyboard.press("Enter");
  await enterExpression(page, 4, "y_1~m*x_1+b");
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "b = 1 · m = 3",
  );
  await expect(page.locator(".graph-curve").first()).toBeVisible();
  await expression(page, 5).focus();
  await page.keyboard.type("e");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toContainText("Question 1");
  await expect(
    page.getByRole("button", { name: "Bookmark question", exact: true }),
  ).toBeVisible();
});

test("Desmos mode keeps separate opaque state through switching, reconnect, completion, and reset recovery", async ({
  page,
  context,
}) => {
  await configured(page);
  await page.route(
    "https://www.desmos.com/api/v1.12/calculator.js?*",
    (route) => route.fulfill({ contentType: "text/javascript", body: mockApi }),
  );
  await openCalculator(page);
  const desmos = () =>
    page
      .frameLocator('iframe[title="Official Desmos graphing calculator"]')
      .getByRole("textbox", { name: "Mock Desmos expression" });
  await desmos().fill("y=x^2");
  await page
    .getByRole("group", { name: "Calculator engine" })
    .getByRole("button", { name: "Offline", exact: true })
    .click();
  await enterExpression(page, 1, "6*7");
  await page
    .getByRole("group", { name: "Calculator engine" })
    .getByRole("button", { name: "Desmos", exact: true })
    .click();
  await expect(desmos()).toHaveValue("y=x^2");
  await context.setOffline(true);
  await expect(
    page.getByText("Connection lost.", { exact: false }),
  ).toBeVisible();
  await expectExpression(page, 1, "6*7");
  await context.setOffline(false);
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.unroute("https://www.desmos.com/api/v1.12/calculator.js?*");
  await page.route(
    "https://www.desmos.com/api/v1.12/calculator.js?*",
    (route) => route.abort(),
  );
  await page.reload();
  await page
    .getByRole("button", { name: /^Resume practice:/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(
    page.getByText("Desmos is unavailable.", { exact: false }),
  ).toBeVisible();
  await expectExpression(page, 1, "6*7");
  await page.unroute("https://www.desmos.com/api/v1.12/calculator.js?*");
  await page.route(
    "https://www.desmos.com/api/v1.12/calculator.js?*",
    (route) => route.fulfill({ contentType: "text/javascript", body: mockApi }),
  );
  await page.getByRole("button", { name: "Retry Desmos", exact: true }).click();
  await expect(desmos()).toHaveValue("y=x^2");
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Clear calculator confirmation" })
    .getByRole("button", { name: "Clear", exact: true })
    .click();
  await expect(desmos()).toHaveValue("");
  await desmos().fill("y=x^2");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Calculator workspace", exact: true })
    .click();
  await expect(desmos()).toHaveValue("y=x^2");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore previous study state", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page
    .getByRole("button", { name: /^Open session results:/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Calculator workspace", exact: true })
    .click();
  await expect(desmos()).toHaveValue("y=x^2");
});

test("failed and slow hosted scripts yield usable Offline work and explicit retry", async ({
  page,
}) => {
  await configured(page);
  await page.route(
    "https://www.desmos.com/api/v1.12/calculator.js?*",
    (route) => route.abort(),
  );
  await openCalculator(page);
  await expect(
    page.getByText("Desmos is unavailable.", { exact: false }),
  ).toBeVisible();
  await enterExpression(page, 1, "sqrt(81)");
  await expect(page.locator(".calc-numeric-result")).toHaveText("= 9");
  await page.unroute("https://www.desmos.com/api/v1.12/calculator.js?*");
  await page.route(
    "https://www.desmos.com/api/v1.12/calculator.js?*",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 7200));
      await route.abort().catch(() => {});
    },
  );
  await page.getByRole("button", { name: "Retry Desmos", exact: true }).click();
  await expect(
    page.getByText("Desmos did not respond.", { exact: false }),
  ).toBeVisible({ timeout: 9000 });
  await expectExpression(page, 1, "sqrt(81)");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.locator("article.question-card").focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toContainText("Question 2");
});
