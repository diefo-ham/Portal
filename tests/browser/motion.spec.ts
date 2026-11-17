import { expect, test, type Page } from "@playwright/test";
import { loadSample } from "./seed";

const animationOf = (page: Page, selector: string, pseudo?: string) =>
  page.evaluate(
    ([selector, pseudo]) =>
      getComputedStyle(document.querySelector(selector)!, pseudo ?? null)
        .animationName,
    [selector, pseudo] as const,
  );

async function openSettingsAndDialog(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("pages fade in, dialogs rise, and disclosures unfold", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page);
  expect(await animationOf(page, "main.page")).toBe("page-in");
  await page.getByText("Refine selection").click();
  expect(await animationOf(page, "details[open] > :not(summary)")).toBe(
    "unfold",
  );
  await openSettingsAndDialog(page);
  expect(await animationOf(page, "dialog[open]")).toBe("dialog-in");
  expect(await animationOf(page, "dialog[open]", "::backdrop")).toBe("fade-in");
});

test("asking for less motion turns all of it off, and a theme change is immediate", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");
  await loadSample(page);
  expect(await animationOf(page, "main.page")).toBe("none");
  await page.getByText("Refine selection").click();
  expect(await animationOf(page, "details[open] > :not(summary)")).toBe("none");
  await openSettingsAndDialog(page);
  expect(await animationOf(page, "dialog[open]")).toBe("none");
  expect(await animationOf(page, "dialog[open]", "::backdrop")).toBe("none");
  await page.keyboard.press("Escape");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  // No cross-fade: the new theme is on the page at once.
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("dark");
});

test("on/off preferences are switches that still work as checkboxes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const timer = page.getByRole("checkbox", { name: "Timer on by default" });
  await expect(timer).toBeChecked();
  expect(await timer.evaluate((el) => getComputedStyle(el).appearance)).toBe(
    "none",
  );
  const knob = () =>
    timer.evaluate((el) => getComputedStyle(el, "::before").transform);
  await expect.poll(knob).not.toBe("none");
  // Clicking the words toggles it, as with any checkbox.
  await page.getByText("Timer on by default", { exact: true }).click();
  await expect(timer).not.toBeChecked();
  await expect.poll(knob).toBe("none");
  await timer.press("Space");
  await expect(timer).toBeChecked();
});

test.describe("while the examples are copied in", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("the loading screen shows the mark, working, then the app", async ({
    page,
  }) => {
    await page.route("**/examples/questions.json", async (route) => {
      await new Promise((done) => setTimeout(done, 1500));
      await route.continue();
    });
    await page.goto("/#/sat");
    await expect(page.locator(".loading-mark.working")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".loading-mark")).toHaveCount(0);
  });
});
