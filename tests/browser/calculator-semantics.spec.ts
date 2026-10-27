import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { expression, enterExpression, expectExpression } from "./math-input";

async function open(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
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
  await expect(expression(page, 1)).toBeFocused();
}
async function equalUnits(page: Page) {
  await expect
    .poll(() =>
      page.locator(".graph-plane").evaluate((el) => {
        const svg = el as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        return (
          rect.width /
          (Number(svg.dataset.xMax) - Number(svg.dataset.xMin)) /
          (rect.height / (Number(svg.dataset.yMax) - Number(svg.dataset.yMin)))
        );
      }),
    )
    .toBeCloseTo(1, 2);
}

test("structural ranges, named curves, updates, quiet blank rows and Fraction", async ({
  page,
}) => {
  await open(page);
  expect(
    await page
      .locator(".dcg-mq-root-block")
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").content),
  ).toMatch(/none|""/);
  await page.keyboard.type("L=[1...10]");
  await expect(page.locator(".calc-list-result")).toHaveText(
    "[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  );
  await enterExpression(page, 1, "L=[1,3...11]");
  await expect(page.locator(".calc-list-result")).toHaveText(
    "[1, 3, 5, 7, 9, 11]",
  );
  await enterExpression(page, 1, "p=3x+4");
  await page.keyboard.press("Enter");
  await enterExpression(page, 2, "v=x+5");
  await page.keyboard.press("Enter");
  await enterExpression(page, 3, "pv-2p+v");
  await expect(page.locator(".graph-curve")).toHaveCount(3);
  await expect(page.locator(".calc-error")).toHaveCount(0);
  const curve = page.locator(".graph-curve").nth(2);
  const before = await curve.getAttribute("d");
  mkdirSync("private-data/inspection", { recursive: true });
  await page.screenshot({
    path: "private-data/inspection/offline-named-parity.png",
  });
  await enterExpression(page, 1, "p=4x+1");
  await expect(curve).not.toHaveAttribute("d", before!);
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await enterExpression(page, 1, "1/3");
  await expect(
    page.getByRole("button", { name: "Toggle fraction", exact: true }),
  ).toHaveText("Fraction");
  await page
    .getByRole("button", { name: "Toggle fraction", exact: true })
    .click();
  await expect(page.locator(".calc-numeric-result")).toHaveText("≈ 1/3");
});

test("split dragging, keyboard limits, outer resizing and ratio persistence keep equal units", async ({
  page,
}) => {
  await open(page);
  const divider = page.getByRole("separator", {
    name: "Expression and graph divider",
  });
  await expect(divider).toBeVisible();
  const initial = (await page.locator(".calc-expression-area").boundingBox())!;
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 84, box.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await page.locator(".calc-expression-area").boundingBox())!.width,
    )
    .toBeGreaterThan(initial.width + 60);
  await equalUnits(page);
  await divider.focus();
  await page.keyboard.press("Home");
  expect(
    (await page.locator(".calc-expression-area").boundingBox())!.width,
  ).toBeGreaterThanOrEqual(229);
  await page.keyboard.press("End");
  expect(
    (await page.locator(".graph-area").boundingBox())!.width,
  ).toBeGreaterThanOrEqual(239);
  await page.keyboard.press("ArrowLeft");
  const ratio = await divider.getAttribute("aria-valuenow");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(divider).toHaveAttribute("aria-valuenow", ratio!);
  await page
    .getByRole("button", { name: "Resize calculator width", exact: true })
    .focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await equalUnits(page);
  await expect(
    page.getByRole("button", { name: "Square axes", exact: true }),
  ).toHaveCount(0);
  await enterExpression(page, 1, "x^2+y^2=9");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await equalUnits(page);
  const circleRatio = await page
    .locator(".graph-curve")
    .first()
    .evaluate((path) => {
      const rect = (path as SVGGraphicsElement).getBBox();
      return rect.width / rect.height;
    });
  expect(circleRatio).toBeCloseTo(1, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(divider).not.toBeVisible();
  await equalUnits(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Inspect points clears empty clicks and disable, keeps multiple labels, and recognizes radicals", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "y=sinx");
  const inspect = page.getByRole("button", {
    name: "Inspect points",
    exact: true,
  });
  await inspect.click();
  const pi = page.getByRole("button", { name: /^zero ≈ \(3\.141592/ });
  const max = page.getByRole("button", { name: /^maximum ≈ \(1\.570796/ });
  await pi.click();
  await max.click();
  await page.mouse.move(20, 20);
  await expect(page.locator(".graph-point-label")).toHaveCount(2);
  await pi.click();
  await page.mouse.move(20, 20);
  await expect(page.locator(".graph-point-label")).toHaveCount(1);
  const graph = page.locator(".graph-plane");
  await graph.click({ position: { x: 16, y: 16 } });
  await expect(page.locator(".graph-point-label")).toHaveCount(0);
  await max.click();
  await inspect.click();
  await expect(page.locator(".graph-point-label")).toHaveCount(0);
  await inspect.click();
  await expect(page.locator(".graph-point-label")).toHaveCount(0);
  await enterExpression(page, 1, "(sqrt(2)/2,-sqrt(3)/2)");
  await page.locator(".graph-data-point").click();
  await expect(page.locator(".graph-point-label")).toContainText(
    "(√2/2, −√3/2)",
  );
  await enterExpression(page, 1, "y=sinx");
  await enterExpression(page, 2, "y=cosx");
  await page
    .getByRole("button", { name: /^intersection ≈ \(0\.785398/ })
    .click();
  await expect(
    page.locator(".graph-point-label").filter({ hasText: "(π/4, √2/2)" }),
  ).toBeVisible();
});

test("color choices persist and leave ordinary visibility/scalar behavior intact", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "y=x^2");
  const dot = page.getByRole("button", {
    name: "Hide expression 1",
    exact: true,
  });
  await dot.click({ button: "right" });
  const palette = page.getByRole("group", { name: "Color for expression 1" });
  await palette
    .getByRole("button", { name: "Terracotta", exact: true })
    .click();
  await expect(page.locator(".calc-entry").first()).toHaveClass(
    /graph-color-2/,
  );
  await expect(page.locator(".graph-color-2 .graph-curve")).toBeVisible();
  await dot.click();
  await expect(page.locator(".graph-curve")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show expression 1", exact: true })
    .click();
  await dot.focus();
  await page.keyboard.press("Shift+Enter");
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(dot).toBeFocused();
  const divider = page.getByRole("separator", {
    name: "Expression and graph divider",
  });
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  const savedSplit = await divider.getAttribute("aria-valuenow");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Resume practice:/ }).first(),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /^Resume practice:/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(page.locator(".calc-entry").first()).toHaveClass(
    /graph-color-2/,
  );
  await expect(divider).toHaveAttribute("aria-valuenow", savedSplit!);
  await expectExpression(page, 1, "y=x^2");
  await enterExpression(page, 1, "a=2");
  await expect(page.locator(".calc-color-control")).toHaveCount(0);
});
