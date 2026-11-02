import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { enterExpression } from "./math-input";

test("coupled polynomial branches, rational holes, empty intersections and conic families", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "a^2+b^2=25");
  await enterExpression(page, 2, "ab=12");
  await expect(page.getByLabel("Real parameter solutions").first()).toHaveText(
    "a = -4, b = -3 or a = -3, b = -4 or a = 3, b = 4 or a = 4, b = 3",
  );
  await enterExpression(page, 1, "(a^2+b^2-25)/(a-3)=0");
  await expect(page.getByLabel("Real parameter solutions").first()).toHaveText(
    "a = -4, b = -3 or a = -3, b = -4 or a = 4, b = 3",
  );
  await enterExpression(page, 1, "a^2+b^2=1");
  await enterExpression(page, 2, "ab=1");
  await expect(page.locator(".calc-entry").first()).toContainText(
    "No real solution",
  );
  await enterExpression(page, 1, "a^2+b^2=25");
  await enterExpression(page, 2, "2a^2+2b^2=50");
  await expect(page.locator(".calc-entry").first()).toContainText(
    "free solution family",
  );
  await expect(page.getByLabel("Real parameter solutions")).toHaveCount(0);
});

test("coordinate systems retain graphs and expose every visible algebraic intersection", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "x^2+y^2=25");
  await enterExpression(page, 2, "xy=12");
  await expect(page.getByLabel("Real parameter solutions").first()).toHaveText(
    "x = -4, y = -3 or x = -3, y = -4 or x = 3, y = 4 or x = 4, y = 3",
  );
  await page
    .getByRole("button", { name: "Inspect points", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(
    page.locator(".graph-interest[aria-label*='intersection']"),
  ).toHaveCount(4);
  mkdirSync("private-data/inspection", { recursive: true });
  await page.screenshot({
    path: "private-data/inspection/coupled-circle-product.png",
  });
  await enterExpression(page, 1, "y=x+1");
  await enterExpression(page, 2, "y=x^2-3");
  const solutions = page.getByLabel("Real parameter solutions").first();
  await expect(solutions).toContainText(" or ");
  await expect(
    page.locator(".graph-interest[aria-label*='intersection']"),
  ).toHaveCount(2);
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await page.screenshot({
    path: "private-data/inspection/coupled-line-quadratic.png",
  });
  // Moving the graph window never changes the reported algebraic solution set.
  const before = await solutions.textContent();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(solutions).toHaveText(before!);
});

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
}

test("percentage families, exact product/power solutions, derived quantities and regression", async ({
  page,
}) => {
  await open(page);
  const percent = "[a,a,c] ~ [230% of b,60% of c,p% of b]";
  await enterExpression(page, 1, percent);
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "a = 2.3 · b = 1 · c = 3.833333333 · p = 383.3333333",
  );
  await expect(page.locator(".calc-fit-result")).toContainText("RMSE = 0");
  await expect(page.locator(".calc-entry").first()).toContainText(
    "Representative fit; parameters are not unique.",
  );
  await enterExpression(page, 1, percent + "{b>0}");
  await expect(page.getByLabel("Fitted parameters")).toContainText("b = 1");
  await expect(page.getByLabel("Fitted parameters")).toContainText(
    "p = 383.3333333",
  );
  mkdirSync("private-data/inspection", { recursive: true });
  await page.screenshot({
    path: "private-data/inspection/finite-percentage.png",
  });
  await enterExpression(page, 1, percent);
  await enterExpression(page, 2, "b>0");
  await expect(page.getByLabel("Fitted parameters")).toContainText("b = 1");
  await expect(page.locator(".calc-entry").nth(1)).toContainText(
    "Restriction applied to the fit",
  );

  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await enterExpression(page, 1, "a+b=5");
  await expect(page.locator(".calc-entry").first()).toContainText(
    "not uniquely determined",
  );
  await enterExpression(page, 2, "ab=6");
  await expect(page.getByLabel("Real parameter solutions").first()).toHaveText(
    "a = 2, b = 3 or a = 3, b = 2",
  );
  await enterExpression(page, 3, "a+b");
  await expect(page.locator(".calc-numeric-result").last()).toHaveText("= 5");
  await page.screenshot({ path: "private-data/inspection/finite-product.png" });
  await enterExpression(page, 2, "a*b=6{a<2.5}");
  await expect(page.getByLabel("Real parameter solutions").first()).toHaveText(
    "a = 2, b = 3",
  );
  await enterExpression(page, 1, "a+b=7");
  await enterExpression(page, 2, "a^2+b^2=25");
  await expect(page.getByLabel("Real parameter solutions").first()).toHaveText(
    "a = 3, b = 4 or a = 4, b = 3",
  );

  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await enterExpression(page, 1, "a+b=5");
  await enterExpression(page, 2, "a");
  await expect(page.locator(".calc-entry").nth(1)).toContainText(
    "This quantity is not uniquely determined",
  );
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await page.screenshot({
    path: "private-data/inspection/finite-underdetermined.png",
  });

  await page
    .getByRole("button", { name: "Clear calculator", exact: true })
    .click();
  await enterExpression(page, 1, "x_1=[1,2,3]");
  await enterExpression(page, 2, "y_1=[4,7,10]");
  await enterExpression(page, 3, "y_1~m*x_1+b");
  await expect(page.getByLabel("Fitted parameters")).toHaveText(
    "b = 1 · m = 3",
  );
  await expect(page.locator(".calc-fit-result")).toContainText("RMSE");
  await expect(page.locator(".calc-error")).toHaveCount(0);
  await page.screenshot({
    path: "private-data/inspection/finite-regression.png",
  });
});
