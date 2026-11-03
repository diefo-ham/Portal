import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { enterExpression, expression } from "./math-input";
import { loadSample } from "./seed";

async function open(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
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

async function domainExtents(page: Page) {
  return page.locator(".graph-plane").evaluate((element) => {
    const svg = element as SVGSVGElement;
    const min = Number(svg.dataset.xMin),
      max = Number(svg.dataset.xMax);
    return [...svg.querySelectorAll<SVGPathElement>(".graph-curve")].map(
      (path) => {
        const xs = [
          ...(path.getAttribute("d") ?? "").matchAll(/[ML](-?[\d.]+),/g),
        ].map(
          (match) =>
            min + (Number(match[1]) / svg.viewBox.baseVal.width) * (max - min),
        );
        return { min: Math.min(...xs), max: Math.max(...xs), count: xs.length };
      },
    );
  });
}

test("restricted curves render only valid domains and retain disconnected paths", async ({
  page,
}) => {
  await open(page);
  mkdirSync("private-data/inspection", { recursive: true });
  for (const [source, min, max, name] of [
    ["f(x)=x{x>2}", 2, 10, "line"],
    ["y=x^2{-3<x<3}", -3, 3, "parabola"],
    ["y=sqrt(x){x>=1}", 1, 10, "sqrt"],
  ] as const) {
    await enterExpression(page, 1, source);
    await expect(page.locator(".calc-error")).toHaveCount(0);
    await expect(page.locator(".graph-curve")).toHaveCount(1);
    // The graph can still be settling to its final size; judge the settled one.
    await expect
      .poll(async () => (await domainExtents(page))[0].count)
      .toBeGreaterThan(20);
    // SVG coordinates are rounded to hundredths of a pixel.
    await expect
      .poll(async () => (await domainExtents(page))[0].min)
      .toBeGreaterThanOrEqual(min - 0.002);
    await expect
      .poll(async () => (await domainExtents(page))[0].max)
      .toBeLessThanOrEqual(max + 0.002);
    // Keep the parabola's finite endpoints visible in the visual QA capture.
    if (name === "parabola")
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.screenshot({
      path: `private-data/inspection/domain-${name}.png`,
    });
    if (name === "parabola")
      await page
        .getByRole("button", { name: "Reset view", exact: true })
        .click();
  }
  await enterExpression(page, 1, "y=x{x^2>1}");
  await expect(page.locator(".graph-curve")).toHaveCount(2);
  for (const extent of await domainExtents(page))
    expect(extent.max <= -1 + 0.002 || extent.min >= 1 - 0.002).toBe(true);
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  await enterExpression(page, 1, "y=x{x>2}");
  await enterExpression(page, 2, "y=1");
  await expect(page.locator(".graph-interest")).toHaveCount(1); // y=1 intercept only
  await expect(
    page.locator(".graph-interest[aria-label*='intersection']"),
  ).toHaveCount(0);
  await enterExpression(page, 2, "y=4");
  await expect(
    page.locator(".graph-interest[aria-label*='intersection']"),
  ).toHaveCount(1);
});

test("constant edits, downstream undefined values, persistence and parameter constraints coexist", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "a=2");
  await enterExpression(page, 2, "f(x)=3x{x>a}");
  await expect(page.locator(".calc-error")).toHaveCount(0);
  mkdirSync("private-data/inspection", { recursive: true });
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.screenshot({
    path: "private-data/inspection/domain-constant.png",
  });
  const before = await page.locator(".graph-curve").getAttribute("d");
  await enterExpression(page, 3, "g(x)=f(x)+1");
  await enterExpression(page, 4, "g(2)");
  await expect(page.locator(".calc-error")).toHaveText(/Undefined/);
  await enterExpression(page, 1, "a=1");
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await expect(page.locator(".calc-numeric-result").last()).toHaveText("= 7");
  await expect(page.locator(".graph-curve").first()).not.toHaveAttribute(
    "d",
    before!,
  );
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(page.locator(".calc-numeric-result").last()).toHaveText("= 7");
  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await enterExpression(page, 1, "x_1=[1,2,3]");
  await enterExpression(page, 2, "y_1=[3,2,1]");
  await enterExpression(page, 3, "y_1~m*x_1+b{m>=0}");
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "m = 0 · b = 2",
  );
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await page.screenshot({
    path: "private-data/inspection/domain-regression.png",
  });
  await enterExpression(page, 4, "n^2~4{n>0}");
  await expect(page.getByLabel("Fitted parameters").last()).toHaveText("n = 2");
  await enterExpression(page, 5, "f(x)=x{x>}");
  await expect(page.locator(".calc-error")).toContainText(/restriction/i);
  await expression(page, 5).focus();
});
