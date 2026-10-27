import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import type { StudyData } from "../../src/core/model";
import { expression, enterExpression, expectExpression } from "./math-input";

async function state(page: Page): Promise<StudyData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<StudyData>((resolve) => {
      const tx = db.transaction("state");
      const r = tx.objectStore("state").get("current");
      r.onsuccess = () => resolve(r.result);
      tx.oncomplete = () => db.close();
    });
  });
}
async function start(page: Page) {
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
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Expression 1", exact: true }),
  ).toBeFocused();
}
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

test("offline graph workspace, inspection, zoom/pan and keyboard isolation", async ({
  page,
  context,
}) => {
  const remote: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/*", async (route) => {
    if (
      !route.request().url().startsWith("http://127.0.0.1:4318") &&
      !route.request().url().startsWith("data:")
    ) {
      remote.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await start(page);
  await enterExpression(page, 1, "y=x^2-4");
  await page.keyboard.press("Enter");
  await expect(expression(page, 2)).toBeFocused();
  await enterExpression(page, 2, "y=0");
  await expect(page.locator(".graph-curve").first()).toHaveAttribute("d", /M/);
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  await expect(page.locator(".graph-interest").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /intersection ≈ \(2, 0\)/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.locator(".graph-plane").focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toContainText("Question 1");
  const plane = page.locator(".graph-plane");
  await plane.scrollIntoViewIfNeeded();
  const beforeDrag = await plane.locator("desc").textContent();
  const bounds = (await plane.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.1,
    bounds.y + bounds.height * 0.1,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.1 + 30,
    bounds.y + bounds.height * 0.1 + 10,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect(plane.locator("desc")).not.toHaveText(beforeDrag!);
  const beforeWheel = await plane.locator("desc").textContent();
  await page.mouse.wheel(0, -120);
  await expect(plane.locator("desc")).not.toHaveText(beforeWheel!);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await enterExpression(page, 2, "b");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Bookmark question", exact: true }),
  ).toBeVisible();
  expect((await state(page)).attempts).toEqual([]);
  await enterExpression(page, 2, "345*.17");
  await expect(page.locator(".calc-numeric-result")).toHaveText("= 58.65");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await expect(page.locator("article")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toContainText("Question 2");
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expectExpression(page, 1, "y=x^2-4");
  await expectExpression(page, 2, "345*.17");
  await page
    .getByRole("button", { name: "Hide expression 1", exact: true })
    .click();
  await expect(page.locator(".graph-curve")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show expression 1", exact: true })
    .click();
  await expect(page.locator(".graph-curve").first()).toBeVisible();
  await enterExpression(page, 1, "x<100");
  await expect(page.locator("rect.graph-shade")).toHaveAttribute(
    "width",
    /[1-9]/,
  );
  await enterExpression(page, 1, "y<100");
  await expect(page.locator("path.graph-shade").first()).toHaveAttribute(
    "d",
    /M/,
  );

  await page.keyboard.press("Escape");
  await expect(page.locator("article")).toBeFocused();
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
});

test("tables, pasted rows, fits, sliders and session persistence through reset recovery", async ({
  page,
}) => {
  await start(page);
  await enterExpression(page, 1, "y=ax^2+bx+c");
  for (const name of ["a", "b", "c"])
    await page
      .getByRole("button", { name: `Add ${name} slider`, exact: true })
      .click();
  await expect(
    page.getByRole("slider", { name: "a slider", exact: true }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "a slider", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expectExpression(page, 2, "a = 1.1");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByRole("group", { name: "Add calculator item" })
    .getByRole("button", { name: "Table", exact: true })
    .click();
  const table = page.getByRole("region", { name: "Data table 5", exact: true });
  const cell = table.getByRole("textbox").first();
  await cell.evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "x₁\ty₁\n1\t4\n2\t7\n3\t10");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  });
  await table
    .getByRole("combobox", { name: "Fit model" })
    .selectOption("linear");
  await expect(table.getByLabel("Regression coefficients")).toHaveText(
    "b = 1 · m = 3",
  );
  await expect(table.locator(".katex-error")).toHaveCount(0);
  await expect(table.locator(".calc-math")).toContainText("≈");
  await expect(page.locator(".graph-data-point")).toHaveCount(3);
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page
    .getByRole("button", { name: "Resize calculator", exact: true })
    .focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(
    page.getByRole("button", { name: "Resize calculator", exact: true }),
  ).toBeFocused();
  mkdirSync("private-data/inspection", { recursive: true });
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "private-data/inspection/calculator-table-fit.png",
    fullPage: true,
    animations: "disabled",
  });

  await table.getByRole("textbox").last().focus();
  await page.keyboard.press("Enter");
  await expect(table.getByRole("textbox")).toHaveCount(8);
  await table
    .getByRole("button", { name: "Remove data row 4", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  const first = (await state(page)).sessions[0];
  expect(first.calculator?.entries).toHaveLength(6);
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expectExpression(page, 1, "");
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).last().click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expectExpression(page, 1, "y=ax^2+bx+c");
  await expect(page.getByLabel("Regression coefficients")).toHaveText(
    "b = 1 · m = 3",
  );
  await page
    .getByRole("button", { name: "Close calculator", exact: true })
    .click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Study progress reset");
  await page
    .getByRole("button", { name: "Restore previous study state", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Previous study state restored",
  );
  expect(
    (await state(page)).sessions.find((s) => s.id === first.id)?.calculator,
  ).toEqual(first.calculator);
});

for (const theme of ["light", "dark"])
  test(`${theme} calculator: laptop layouts, expanded view, math rendering and errors`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("sat-theme", value),
      theme,
    );
    await start(page);
    await enterExpression(page, 1, "y=x^2-4");
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await page
      .getByRole("group", { name: "Add calculator item" })
      .getByRole("button", { name: "Expression", exact: true })
      .click();
    await enterExpression(page, 2, "y=2x+3");
    await expect(page.locator(".graph-curve")).toHaveCount(2);
    await expect(page.locator(".calc-error")).toHaveCount(0);
    await expect(page.locator(".dcg-mq-root-block").first()).toBeVisible();
    mkdirSync("private-data/inspection", { recursive: true });
    for (const width of [1366, 1280, 1024, 1920, 820, 390]) {
      await page.setViewportSize({ width, height: 768 });
      expect(await overflow(page), `calculator at ${width}`).toBe(false);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: `private-data/inspection/calculator-${theme}-practice.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Reset calculator window", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Inspect points", exact: true })
      .click();
    await page.screenshot({
      path: `private-data/inspection/calculator-${theme}-expanded.png`,
      fullPage: true,
      animations: "disabled",
    });
    await enterExpression(page, 2, "sqrt(-1)");
    await expect(page.getByRole("status")).toContainText(
      "Undefined or outside the supported numeric range",
    );
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await page
      .getByRole("group", { name: "Add calculator item" })
      .getByRole("button", { name: "Table", exact: true })
      .click();
    await page.setViewportSize({ width: 1024, height: 768 });
    expect(await overflow(page)).toBe(false);
  });
