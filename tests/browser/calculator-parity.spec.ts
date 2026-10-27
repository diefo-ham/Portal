import { test, expect, type Page } from "@playwright/test";
import { expression, enterExpression, expectExpression } from "./math-input";
import { mkdirSync } from "node:fs";

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

test("floating geometry overlays unchanged Practice, resizes in all directions, persists, and recovers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openCalculator(page);
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  const before = await page.locator(".question-card").boundingBox();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  const panel = page.getByLabel("Calculator panel", { exact: true });
  expect(await page.locator(".question-card").boundingBox()).toEqual(before);
  const initial = (await panel.boundingBox())!;
  const title = (await page
    .getByRole("button", { name: "Move calculator", exact: true })
    .boundingBox())!;
  await page.mouse.move(title.x + 50, title.y + 15);
  await page.mouse.down();
  await page.mouse.move(title.x - 150, title.y - 30, { steps: 4 });
  await page.mouse.up();
  const moved = (await panel.boundingBox())!;
  expect(moved.x).toBeLessThan(initial.x);
  const resize = async (name: string, dx: number, dy: number) => {
    const handle = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2 + dx,
      handle.y + handle.height / 2 + dy,
      { steps: 5 },
    );
    await page.mouse.up();
  };
  await resize("Resize calculator width", -80, 0);
  expect((await panel.boundingBox())!.width).toBeLessThan(moved.width - 70);
  const w = (await panel.boundingBox())!;
  await resize("Resize calculator height", 0, -70);
  expect((await panel.boundingBox())!.height).toBeLessThan(w.height - 60);
  const h = (await panel.boundingBox())!;
  await resize("Resize calculator", 40, 40);
  expect((await panel.boundingBox())!.width).toBeGreaterThan(h.width + 30);
  expect((await panel.boundingBox())!.height).toBeGreaterThan(h.height + 30);
  await page
    .getByRole("button", { name: "Resize calculator", exact: true })
    .focus();
  await page.keyboard.press("Shift+ArrowRight");
  const saved = await panel.boundingBox();
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  expect(await panel.boundingBox()).toEqual(saved);
  await resize("Resize calculator", -2000, -2000);
  expect((await panel.boundingBox())!.width).toBe(440);
  expect((await panel.boundingBox())!.height).toBe(360);
  await resize("Resize calculator", 3000, 3000);
  const max = (await panel.boundingBox())!;
  expect(max.x + max.width).toBeLessThanOrEqual(1358);
  expect(max.y + max.height).toBeLessThanOrEqual(892);
  await page.setViewportSize({ width: 820, height: 600 });
  await expect
    .poll(async () => {
      const b = (await panel.boundingBox())!;
      return b.x + b.width;
    })
    .toBeLessThanOrEqual(812);
  const clamped = (await panel.boundingBox())!;
  expect(clamped.x).toBeGreaterThanOrEqual(8);
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(812);
  expect(clamped.y + clamped.height).toBeLessThanOrEqual(592);
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(
    page.getByRole("button", { name: "Close calculator", exact: true }),
  ).toBeVisible();
  expect((await panel.boundingBox())!.width).toBe(
    await page.evaluate(() => document.body.clientWidth - 16),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("Desmos stays selectable with no key; Offline never probes or retries the hosted API", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://www.desmos.com/**", (route) => {
    requests++;
    return route.abort();
  });
  await page.route("**/calculator-config.json", (route) =>
    route.fulfill({ json: { desmosApiKey: "" } }),
  );
  await openCalculator(page);
  const engines = page.getByRole("group", { name: "Calculator engine" });
  await expect(
    engines.getByRole("button", { name: "Desmos", exact: true }),
  ).toBeEnabled();
  await engines.getByRole("button", { name: "Desmos", exact: true }).click();
  await expect(
    page.getByText("Desmos needs an API key.", { exact: false }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await engines.getByRole("button", { name: "Offline", exact: true }).click();
  await enterExpression(page, 1, "6*7");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.unroute("**/calculator-config.json");
  await configured(page);
  await page.reload();
  await page
    .getByRole("button", { name: /^Resume practice:/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expectExpression(page, 1, "6*7");
  // A bounded observation of inactivity, not a network availability probe.
  await page.waitForTimeout(300);
  expect(requests).toBe(0);
  await engines.getByRole("button", { name: "Desmos", exact: true }).click();
  await expect(
    page.getByText("Desmos is unavailable.", { exact: false }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await page.waitForTimeout(300);
  expect(requests).toBe(1);
  await engines.getByRole("button", { name: "Offline", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(300);
  expect(requests).toBe(1);
  await engines.getByRole("button", { name: "Desmos", exact: true }).click();
  await expect(
    page.getByText("Desmos is unavailable.", { exact: false }),
  ).toBeVisible();
  expect(requests).toBe(2);
});

test("Offline curve tracing and parameter dragging label the point on the graph", async ({
  page,
}) => {
  await openCalculator(page);
  await enterExpression(page, 1, "y=x");
  const graph = page.locator(".graph-plane");
  const bounds = (await graph.boundingBox())!;
  const position = (x: number, y: number) => ({
    x: bounds.x + ((x + 10) / 20) * bounds.width,
    y: bounds.y + ((10 - y) / 20) * bounds.height,
  });
  const before = await graph.locator("desc").textContent();
  await page.mouse.move(position(2, 2).x, position(2, 2).y);
  await page.mouse.down();
  await page.mouse.move(position(4, 4).x, position(4, 4).y, { steps: 5 });
  await page.mouse.up();
  await expect(graph.locator(".graph-point-label")).toBeVisible();
  mkdirSync("private-data/inspection", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await page.screenshot({
      path: `private-data/inspection/calculator-${theme}-trace.png`,
      animations: "disabled",
    });
  }
  expect(await graph.locator("desc").textContent()).toBe(before);
  const label = await graph.locator(".graph-point-label").textContent();
  await graph.focus();
  await page.keyboard.press("ArrowRight");
  await expect(graph.locator(".graph-point-label")).not.toHaveText(label!);
  await expect(page.locator(".graph-coordinate,.interest-list")).toHaveCount(0);
  await enterExpression(page, 1, "a=2");
  await page.keyboard.press("Enter");
  await enterExpression(page, 2, "f(x)=x^2");
  await page.keyboard.press("Enter");
  await enterExpression(page, 3, "(a,f(a))");
  const point = graph.locator(".graph-data-point");
  await expect(point).toBeVisible();
  const p = (await point.boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    p.x + p.width / 2 + bounds.width / 40,
    p.y + p.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole("slider", { name: "a slider", exact: true }),
  ).not.toHaveValue("2");
  await expect(graph.locator(".graph-point-label")).toBeVisible();
  await point.focus();
  const oldValue = await page
    .getByRole("slider", { name: "a slider", exact: true })
    .inputValue();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("slider", { name: "a slider", exact: true }),
  ).not.toHaveValue(oldValue);
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await expect(graph.locator(".graph-point-label")).toHaveCount(0);
  await expect(page.locator(".calc-structural-input")).toHaveCount(1);
  await enterExpression(page, 1, "y=x^2-4");
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  const zero = page.getByRole("button", { name: "zero ≈ (2, 0)", exact: true });
  await zero.hover();
  await expect(graph.locator(".graph-point-label")).toHaveCount(1);
  await expect(graph.locator(".graph-point-label")).toContainText("(2, 0)");
  await zero.click();
  await page.mouse.move(20, 20);
  await expect(graph.locator(".graph-point-label")).toContainText("(2, 0)");
  await graph.click({ position: { x: 15, y: 15 } });
  await expect(graph.locator(".graph-point-label")).toHaveCount(0);
  await zero.click();
  await expect(graph.locator(".graph-point-label")).toContainText("(2, 0)");
  await zero.click();
  await expect(graph.locator(".graph-point-label")).toHaveCount(0);
  // Move focus away and back, as keyboard navigation would. Calling focus()
  // on the already-focused deselected point intentionally does not reselect it.
  await graph.focus();
  await zero.focus();
  await expect(graph.locator(".graph-point-label")).toContainText("(2, 0)");
  await page.keyboard.press("Escape");
  await expect(graph.locator(".graph-point-label")).toHaveCount(0);
});

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
  await expect(
    page.getByRole("group", { name: "Clear calculator confirmation" }),
  ).toHaveCount(0);
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
  // A loaded hosted engine remains usable; losing internet does not destroy it.
  await expect(desmos()).toHaveValue("y=x^2");
  await page
    .getByRole("group", { name: "Calculator engine" })
    .getByRole("button", { name: "Offline", exact: true })
    .click();
  await expectExpression(page, 1, "6*7");
  await context.setOffline(false);
  await page
    .getByRole("group", { name: "Calculator engine" })
    .getByRole("button", { name: "Desmos", exact: true })
    .click();
  await expect(desmos()).toHaveValue("y=x^2");
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
  await expect(
    page.getByRole("button", { name: "Desmos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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
  await page.getByRole("button", { name: "Use Offline", exact: true }).click();
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
  await page
    .getByRole("group", { name: "Calculator engine" })
    .getByRole("button", { name: "Desmos", exact: true })
    .click();
  await expect(
    page.getByText("Desmos did not respond.", { exact: false }),
  ).toBeVisible({ timeout: 9000 });
  await page.getByRole("button", { name: "Use Offline", exact: true }).click();
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
