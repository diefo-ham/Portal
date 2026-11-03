import { expect, test, type Page } from "@playwright/test";
import { enterExpression, expectExpression, expression } from "./math-input";
import { loadSample } from "./seed";

async function openCalculator(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
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

test("Enter inserts after first, middle and last rows and preserves the existing next row", async ({
  page,
}) => {
  await openCalculator(page);
  await enterExpression(page, 1, "11");
  await enterExpression(page, 2, "22");
  await expression(page, 1).focus();
  await page.keyboard.press("Enter");
  await expect(expression(page, 2)).toBeFocused();
  await expectExpression(page, 1, "11");
  await expectExpression(page, 2, "");
  await expectExpression(page, 3, "22");
  await enterExpression(page, 2, "33");
  await page.keyboard.press("Enter");
  await expect(expression(page, 3)).toBeFocused();
  await expectExpression(page, 2, "33");
  await expectExpression(page, 3, "");
  await expectExpression(page, 4, "22");
  const before = await page.locator(".calc-structural-input").count();
  await expression(page, before).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".calc-structural-input")).toHaveCount(before + 1);
  await expect(expression(page, before + 1)).toBeFocused();
  await expectExpression(page, 4, "22");
});

test("template navigation and table Enter retain their own editing contexts", async ({
  page,
}) => {
  await openCalculator(page);
  await expression(page, 1).focus();
  await page.keyboard.type("1/2");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.type("3");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("4");
  await expectExpression(page, 1, "13/24");
  await page.keyboard.press("Tab"); // structural escape from denominator
  await page.keyboard.press("Enter");
  await expect(expression(page, 2)).toBeFocused();
  await page.keyboard.type("table");
  const table = page.locator(".calc-data-table");
  const cells = table.getByRole("textbox");
  await cells.first().fill("1");
  await cells.nth(1).fill("2");
  const count = await page.locator(".calc-structural-input").count();
  await cells.first().focus();
  await page.keyboard.press("Enter");
  await expect(cells.nth(2)).toBeFocused();
  await expect(page.locator(".calc-structural-input")).toHaveCount(count);
});

test("scalar roots, restrictions and angle mode have coherent visible results", async ({
  page,
}) => {
  await openCalculator(page);
  await enterExpression(page, 1, "52(c^3+64)(c^4-81)~0");
  await expect(page.getByLabel("Real parameter solutions")).toHaveText(
    "c = -4 or c = -3 or c = 3",
  );
  await enterExpression(page, 1, "(c+5)^2~4");
  await expect(page.getByLabel("Real parameter solutions")).toHaveText(
    "c = -7 or c = -3",
  );
  await enterExpression(page, 1, "n^2~4{n>0}");
  await expect(page.getByLabel("Fitted parameters")).toHaveText("n = 2");
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await enterExpression(page, 1, "sin(c)~16/23");
  await expect(page.getByLabel("Real parameter solutions")).toContainText(
    "0.769327",
  );
  await expect(
    page.getByText(/Numerical real solutions searched.*radians/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Degrees", exact: true }).click();
  await expect(page.getByLabel("Real parameter solutions")).toContainText(
    "44.079",
  );
  await expect(
    page.getByText(/Numerical real solutions searched.*degrees/),
  ).toBeVisible();
  await enterExpression(page, 1, "c^2+1~0");
  await expect(page.locator(".calc-error")).toContainText("No real solution");
});

test("coordinate parentheses multiply, scalar adjacency evaluates, and named calls survive", async ({
  page,
}) => {
  await openCalculator(page);
  await expression(page, 1).focus();
  await page.keyboard.type("8x(x");
  await page.keyboard.press("^");
  await page.keyboard.type("9");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("-x");
  await page.keyboard.press("^");
  await page.keyboard.type("8");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("+11)");
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await expect(page.locator("path.graph-curve").first()).toHaveAttribute(
    "d",
    /L/,
  );
  await enterExpression(page, 1, "b=4");
  await enterExpression(page, 2, "c=-6");
  for (const source of ["b c", "bc"]) {
    await enterExpression(page, 3, source);
    await expect(page.locator(".calc-numeric-result")).toHaveText("= -24");
  }
  await enterExpression(page, 3, "f(x)=x^2");
  await enterExpression(page, 4, "g(t)=f(t)+bc");
  await enterExpression(page, 5, "g(3)");
  await expect(page.locator(".calc-numeric-result")).toHaveText("= -15");
  await expect(page.locator(".calc-error")).toHaveCount(0);
});

test("polynomial equations and high-growth curves remain represented through large zoom changes", async ({
  page,
}) => {
  await openCalculator(page);
  await enterExpression(page, 1, "52(x^3+64)(x^4-81)=0");
  await expect(page.locator("line.graph-curve")).toHaveCount(3);
  await page.getByText("Graph window", { exact: true }).click();
  for (const range of [1000, 1000000, 10]) {
    for (const [label, value] of [
      ["xMin", -range],
      ["xMax", range],
      ["yMin", -range],
      ["yMax", range],
    ] as const)
      await page
        .getByRole("spinbutton", { name: label, exact: true })
        .fill(String(value));
    await page
      .getByRole("button", { name: "Apply window", exact: true })
      .click();
    await expect(page.locator("line.graph-curve")).toHaveCount(3);
  }
  await enterExpression(page, 1, "52(x^3+64)(x^4-81)");
  for (const range of [100, 10000, 1000000]) {
    for (const [label, value] of [
      ["xMin", -range],
      ["xMax", range],
      ["yMin", -range],
      ["yMax", range],
    ] as const)
      await page
        .getByRole("spinbutton", { name: label, exact: true })
        .fill(String(value));
    await page
      .getByRole("button", { name: "Apply window", exact: true })
      .click();
    await expect(page.locator("path.graph-curve").first()).toHaveAttribute(
      "d",
      /L/,
    );
    expect(
      await page.locator("path.graph-curve").evaluateAll((paths) =>
        paths.some((path) => {
          const bounds = (path as SVGGraphicsElement).getBBox();
          return bounds.height > 30 && Number.isFinite(bounds.y);
        }),
      ),
    ).toBe(true);
  }
});

test("named function parameters survive editing and solve through a function list", async ({
  page,
}) => {
  await openCalculator(page);
  await enterExpression(page, 1, "f(x)=a x^2+b x+c");
  await expect(
    page.getByText("Free parameters: a, b, c.", { exact: true }),
  ).toBeVisible();
  await enterExpression(page, 2, "g(x)=f(x)+4");
  await enterExpression(page, 3, "[g(21),g(23),g(25)]~[-8,8,-8]");
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "a = -4 · b = 184 · c = -2112",
  );
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await enterExpression(page, 4, "g([21,23,25])");
  await expect(page.locator(".calc-list-result")).toHaveText("[-8, 8, -8]");
});

test("root curves render SVG paths and implicit lines expose intercepts in Inspect Points", async ({
  page,
}) => {
  await openCalculator(page);
  for (const source of ["sqrt(x)", "sqrt(x-1)", "sqrt(1-x^2)", "x^2"]) {
    await enterExpression(page, 1, source);
    await expect(page.locator(".graph-curve").first()).toBeVisible();
    await expect(page.locator(".graph-curve").first()).toHaveAttribute(
      "d",
      /L/,
    );
  }
  await enterExpression(page, 1, "4y+8x=6");
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  await expect(page.locator(".graph-interest")).toHaveCount(2);
  await expect(
    page.locator(".graph-interest[aria-label*='y-intercept']"),
  ).toHaveCount(1);
  await expect(page.locator(".graph-interest[aria-label*='zero']")).toHaveCount(
    1,
  );
  await enterExpression(page, 1, "x^2+y^2=25");
  await expect(page.locator(".graph-interest")).toHaveCount(0);
  await expect(
    page.getByText(/Implicit curve.*no automatic special points/),
  ).toBeVisible();
});
