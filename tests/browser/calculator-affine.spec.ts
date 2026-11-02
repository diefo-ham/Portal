import { test, expect, type Page, type Locator } from "@playwright/test";
import { enterExpression } from "./math-input";

async function open(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Section", exact: true })
    .getByRole("button", { name: "Math", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page
    .getByRole("button", { name: "Start practice →", exact: true })
    .click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await page.getByText("Graph window", { exact: true }).click();
  for (const key of ["xMin", "yMin"])
    await page.getByLabel(key, { exact: true }).fill("-20");
  for (const key of ["xMax", "yMax"])
    await page.getByLabel(key, { exact: true }).fill("20");
  await page.getByRole("button", { name: "Apply window", exact: true }).click();
}

async function filled(group: Locator, x: number, y: number) {
  return group.locator(".graph-shade").evaluate(
    (element, { x, y }) => {
      const path = element as SVGGeometryElement,
        svg = path.ownerSVGElement!;
      const point = svg.createSVGPoint(),
        box = svg.viewBox.baseVal;
      const xMin = Number(svg.dataset.xMin),
        xMax = Number(svg.dataset.xMax);
      const yMin = Number(svg.dataset.yMin),
        yMax = Number(svg.dataset.yMax);
      point.x = ((x - xMin) / (xMax - xMin)) * box.width;
      point.y = ((yMax - y) / (yMax - yMin)) * box.height;
      return path.isPointInFill(point);
    },
    { x, y },
  );
}

async function boundary(group: Locator, a: number, b: number, c: number) {
  const residuals = await group.locator(".graph-curve").evaluate(
    (element, { a, b, c }) => {
      const path = element as SVGPathElement,
        svg = path.ownerSVGElement!,
        box = svg.viewBox.baseVal;
      return [0, 0.5, 1].map((t) => {
        const p = path.getPointAtLength(path.getTotalLength() * t);
        const x =
          Number(svg.dataset.xMin) +
          (p.x / box.width) *
            (Number(svg.dataset.xMax) - Number(svg.dataset.xMin));
        const y =
          Number(svg.dataset.yMax) -
          (p.y / box.height) *
            (Number(svg.dataset.yMax) - Number(svg.dataset.yMin));
        return a * x + b * y + c;
      });
    },
    { a, b, c },
  );
  // SVG coordinates are rendered to hundredths of a pixel.
  for (const r of residuals) expect(Math.abs(r)).toBeLessThan(0.03);
}

test("affine comparisons shade the correct half-plane and use strict/inclusive boundary styles", async ({
  page,
}) => {
  await open(page);
  const group = page.locator("[data-graph-id]").first();
  for (const sample of [
    {
      source: "4x+y<18",
      a: 4,
      b: 1,
      c: -18,
      inside: [0, 0],
      outside: [10, 0],
      strict: true,
    },
    {
      source: "2x-3y>=7",
      a: 2,
      b: -3,
      c: -7,
      inside: [0, -5],
      outside: [0, 5],
      strict: false,
    },
    {
      source: "18>4x+y",
      a: 4,
      b: 1,
      c: -18,
      inside: [0, 0],
      outside: [10, 0],
      strict: true,
    },
    {
      source: "y>14",
      a: 0,
      b: 1,
      c: -14,
      inside: [0, 18],
      outside: [0, 0],
      strict: true,
    },
    {
      source: "-2x>=4",
      a: 1,
      b: 0,
      c: 2,
      inside: [-10, 0],
      outside: [0, 0],
      strict: false,
    },
  ]) {
    await enterExpression(page, 1, sample.source);
    await expect(page.locator(".calc-error")).toHaveCount(0);
    await expect(group.locator(".graph-shade")).toHaveCount(1);
    // The previous sample's shading is still in the page until the graph redraws,
    // so wait for each property to settle instead of reading it once.
    await expect
      .poll(() => filled(group, sample.inside[0], sample.inside[1]))
      .toBe(true);
    await expect
      .poll(() => filled(group, sample.outside[0], sample.outside[1]))
      .toBe(false);
    await expect
      .poll(() =>
        group.locator(".graph-curve").getAttribute("stroke-dasharray"),
      )
      .toBe(sample.strict ? "7 5" : null);
    await expect(() => boundary(group, sample.a, sample.b, sample.c)).toPass();
  }
  await enterExpression(page, 1, "x^2+y^2<9");
  await expect(page.locator(".calc-error")).toContainText(
    "Nonlinear implicit inequalities are unsupported",
  );
  await expect(page.locator("[data-graph-id]")).toHaveCount(0);
});

test("multiple regions retain shading and boundary inspection after pan, zoom, scalar edits and reload", async ({
  page,
}, testInfo) => {
  await open(page);
  await enterExpression(page, 1, "a=4");
  await enterExpression(page, 2, "ax+y<18");
  await enterExpression(page, 3, "y>14");
  const groups = page.locator("[data-graph-id]"),
    plane = page.locator(".graph-plane");
  await expect(groups).toHaveCount(2);
  const verify = async () => {
    expect(await filled(groups.nth(0), 0, 16)).toBe(true);
    expect(await filled(groups.nth(0), 10, 16)).toBe(false);
    expect(await filled(groups.nth(1), 0, 16)).toBe(true);
    expect(await filled(groups.nth(1), 0, 0)).toBe(false);
    await boundary(groups.nth(0), 4, 1, -18);
    await boundary(groups.nth(1), 0, 1, -14);
  };
  await verify();
  await plane.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await verify();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await verify();
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /intersection ≈ \(1, 14\)/ }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("affine-half-planes.png"),
  });
  expect(await filled(groups.nth(0), 5, 0)).toBe(false);
  await enterExpression(page, 1, "a=2");
  await expect.poll(() => filled(groups.nth(0), 5, 0)).toBe(true);
  await boundary(groups.nth(0), 2, 1, -18);
  // Exit awaits the existing persistence flush; do not race its 350 ms debounce
  // with an immediate process/navigation teardown.
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume practice" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  // The calculator open state may be restored or closed on session resume.
  if (!(await plane.isVisible()))
    await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(groups).toHaveCount(2);
  expect(await filled(groups.nth(0), 5, 0)).toBe(true);
});

test("the nonlinear SAT list system reports a labelled representative fit", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "[a,a,c] ~ [230% of b,60% of c,p% of b]");
  await expect(page.locator(".calc-error")).toHaveCount(0);
  // Current behavior (see tests/finiteSystems.test.ts): a representative fit is
  // shown and explicitly labelled as non-unique, rather than refused.
  await expect(page.locator(".calc-entry").first()).toContainText(
    "Representative fit; parameters are not unique.",
  );
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "a = 2.3 · b = 1 · c = 3.833333333 · p = 383.3333333",
  );
});
