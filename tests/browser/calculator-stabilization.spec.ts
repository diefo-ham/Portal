import { test, expect, type Page } from "@playwright/test";
import { expression, enterExpression, expectExpression } from "./math-input";
import { loadSample } from "./seed";
async function start(page: Page) {
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
}
async function calculator(page: Page) {
  await start(page);
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(expression(page, 1)).toBeFocused();
}
test("compact rows, safe shorthand, exact conversion, angle segments and Add menu", async ({
  page,
}) => {
  await calculator(page);
  await expect(page.getByText("Saved on this device")).toHaveCount(0);
  await enterExpression(page, 1, "a=2");
  await expect(
    page.getByRole("slider", { name: "a slider", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide expression 1", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await enterExpression(page, 2, "b=a+2");
  await expect(page.locator(".calc-numeric-result")).toHaveText("= 4");
  await expect(
    page.getByRole("slider", { name: "b slider", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await enterExpression(page, 3, "y=sinx");
  await expect(
    page.getByRole("button", { name: "Hide expression 3", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".graph-curve").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await enterExpression(page, 4, "1/3");
  await page.getByRole("button", { name: "Toggle fraction" }).click();
  await expect(page.locator(".calc-numeric-result").last()).toHaveText("≈ 1/3");
  await enterExpression(page, 4, "sin(90)");
  await page
    .getByRole("group", { name: "Angle mode" })
    .getByRole("button", { name: "Degrees", exact: true })
    .click();
  await expect(page.locator(".calc-numeric-result").last()).toHaveText("= 1");
  await expect(
    page
      .getByRole("group", { name: "Angle mode" })
      .getByRole("button", { name: "Radians", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Add calculator item" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("group", { name: "Add calculator item" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Calculator panel", { exact: true }),
  ).toBeVisible();
});
test("typed table-linked regressions clean/export a quadratic and delete naturally with repeated Backspace", async ({
  page,
}) => {
  await calculator(page);
  await page.keyboard.type("table");
  const table = page.getByRole("region", { name: "Data table 1", exact: true });
  await table
    .getByRole("textbox")
    .first()
    .evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text/plain", "1\t1\n2\t4\n3\t9\n4\t16");
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    });
  await expression(page, 2).focus();
  await page.keyboard.type("y_1~ax_1^2");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("+bx_1+c");
  await expect(page.getByLabel("Fitted parameters")).toContainText("a = 1");
  await expect(page.locator(".calc-fit-result .calc-math")).toContainText("x");
  await expect(page.locator(".calc-fit-result .calc-math")).not.toContainText(
    "10",
  );
  await page
    .getByRole("button", { name: "Export to expression list", exact: true })
    .click();
  await expectExpression(page, 3, "y=x^2");
  await expect(page.getByLabel("Fitted parameters")).toBeVisible();
  await table
    .getByRole("combobox", { name: "Fit model" })
    .selectOption("quadratic");
  await expect(table.getByLabel("Regression coefficients")).toHaveText(
    "c = 0 · b = 0 · a = 1",
  );
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await expression(page, 1).focus();
  await page.keyboard.type("table");
  const cell = page.locator(".calc-data-table input").first();
  await cell.fill("8");
  await page.locator(".calc-data-table input").nth(1).fill("9");
  await page.locator(".calc-data-table input").nth(2).focus();
  // Repeated keydowns carry the browser's repeat flag after the first press.
  for (let i = 0; i < 12; i++) await page.keyboard.down("Backspace");
  await page.keyboard.up("Backspace");
  await expect(page.locator(".calc-data-table")).toHaveCount(0);
  await expect(page.locator(".calc-structural-input")).toHaveCount(1);
  await expect(expression(page, 1)).toBeFocused();
});
test("narrow graphs, minor grid and multiple pi-aware POI labels", async ({
  page,
}) => {
  await calculator(page);
  for (const source of [
    "y=2000x^2",
    "y=100000x^2",
    "y=100000*(x-0.013)^2",
    "y=1/(x-0.123)",
  ]) {
    await enterExpression(page, 1, source);
    await expect(page.locator(".graph-curve").first()).toHaveAttribute(
      "d",
      /M/,
    );
  }
  expect(await page.locator(".graph-minor-grid line").count()).toBeGreaterThan(
    40,
  );
  await enterExpression(page, 1, "y=sinx");
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  const markers = page.locator(".graph-interest");
  const labels = await markers.evaluateAll((es) =>
    es.map((e) => e.getAttribute("aria-label")),
  );
  const piIndex = labels.findIndex((label) => label?.includes("(3.141592"));
  const halfIndex = labels.findIndex((label) => label?.includes("(1.570796"));
  expect(piIndex).toBeGreaterThanOrEqual(0);
  expect(halfIndex).toBeGreaterThanOrEqual(0);
  await markers.nth(piIndex).click();
  await markers.nth(halfIndex).click();
  await expect(page.locator(".graph-point-label")).toHaveCount(2);
  await expect(
    page.locator(".graph-point-label").filter({ hasText: "(π, 0)" }),
  ).toBeVisible();
  await expect(
    page.locator(".graph-point-label").filter({ hasText: "(π/2, 1)" }),
  ).toBeVisible();
  await markers.nth(piIndex).click();
  await expect(page.locator(".graph-point-label")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
});
test("scalar regressions, forgiving POI targets and equal graph units", async ({
  page,
}) => {
  await calculator(page);
  await enterExpression(page, 1, "8c~3");
  await expect(page.getByLabel("Fitted parameters")).toContainText("c = 0.375");
  await expect(page.locator(".calc-fit-result")).toContainText("RMSE = 0");
  await expect(page.locator(".calc-fit-result .calc-math")).toHaveCount(0);

  const graph = page.locator("svg.graph-plane");
  const expectEqualUnits = async () => {
    await expect
      .poll(() =>
        graph.evaluate((element) => {
          const svg = element as SVGSVGElement;
          const box = svg.getBoundingClientRect();
          const x =
            box.width / (Number(svg.dataset.xMax) - Number(svg.dataset.xMin));
          const y =
            box.height / (Number(svg.dataset.yMax) - Number(svg.dataset.yMin));
          return x / y;
        }),
      )
      .toBeCloseTo(1, 2);
  };
  await expect.poll(() => graph.getAttribute("data-equal-axes")).toBe("true");
  await expectEqualUnits();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expectEqualUnits();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expectEqualUnits();
  const resize = page.getByRole("button", {
    name: "Resize calculator width",
    exact: true,
  });
  await resize.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expectEqualUnits();

  await enterExpression(page, 1, "x^2+y^2=25");
  const circleRatio = await graph
    .locator(".graph-curve")
    .first()
    .evaluate((path) => {
      const bounds = (path as SVGGraphicsElement).getBBox();
      return bounds.width / bounds.height;
    });
  expect(circleRatio).toBeCloseTo(1, 1);

  await enterExpression(page, 1, "y=sinx");
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  const markers = page.locator(".graph-interest");
  const labels = await markers.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label")),
  );
  const maximum = labels.findIndex(
    (label) => label?.includes("maximum") && label.includes("1.570796"),
  );
  const zero = labels.findIndex((label) => label?.includes("zero ≈ (3.141592"));
  expect(maximum).toBeGreaterThanOrEqual(0);
  expect(zero).toBeGreaterThanOrEqual(0);
  const maxBox = (await markers.nth(maximum).boundingBox())!;
  await page.mouse.click(
    maxBox.x + maxBox.width / 2 + 15,
    maxBox.y + maxBox.height / 2,
  );
  await expect(page.locator(".graph-point-label")).toContainText("(π/2, 1)");
  const zeroBox = (await markers.nth(zero).boundingBox())!;
  await page.mouse.click(
    zeroBox.x + zeroBox.width / 2 + 15,
    zeroBox.y + zeroBox.height / 2,
  );
  await expect(page.locator(".graph-point-label")).toHaveCount(2);
  await expect(
    page.locator(".graph-point-label").filter({ hasText: "(π, 0)" }),
  ).toBeVisible();
  await page.mouse.click(
    maxBox.x + maxBox.width / 2,
    maxBox.y + maxBox.height / 2 + 30,
  );
  await expect(page.locator(".graph-point-label")).toHaveCount(0);
});
test("Escape closes utilities first, then confirms leaving without calculator leakage", async ({
  page,
}) => {
  await start(page);
  await page.locator("article.question-card").focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Leave session", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("article.question-card")).toBeVisible();
  await page
    .getByRole("button", { name: "Practice tools", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Leave session", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expression(page, 1).focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Leave session", exact: true }),
  ).toHaveCount(0);
  await page.locator("article.question-card").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /^Resume practice:/ }).first(),
  ).toBeVisible();
});
