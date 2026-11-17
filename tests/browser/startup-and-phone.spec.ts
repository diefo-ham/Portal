import { expect, test, type Page, type Route } from "@playwright/test";
import { loadSample } from "./seed";

// A real first run: the bundled examples are on, as on a fresh install.
const firstRun = { cookies: [], origins: [] };

const stored = (page: Page) =>
  page.getByText(/questions · \d+ attempts · \d+ bookmarks/);

/** Ways a host can answer for the optional local library when it has none. */
const noLibrary: [string, (route: Route) => Promise<void>][] = [
  ["403", (route) => route.fulfill({ status: 403, body: "Forbidden" })],
  ["500", (route) => route.fulfill({ status: 500, body: "Server error" })],
  [
    "a web page instead of a file",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Not here</title>",
      }),
  ],
  ["no answer at all", (route) => route.abort()],
];

test.describe("the optional local library never blocks the first run", () => {
  test.use({ storageState: firstRun });
  for (const [name, answer] of noLibrary)
    test(`examples load when the host answers ${name}`, async ({ page }) => {
      await page.route("**/local-library/manifest.json", answer);
      await page.goto("/#/sat");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await expect(stored(page)).toContainText("120 questions");
      await expect(page.locator(".banner.error")).toHaveCount(0);
    });

  test("a damaged local library is reported, and the examples still load", async ({
    page,
  }) => {
    await page.route("**/local-library/**", (route) =>
      route.request().url().endsWith("manifest.json")
        ? route.fulfill({
            json: {
              format: "sat-study-local-library-v1",
              revision: "a".repeat(64),
              questionCount: 1,
              assets: [],
              label: "Damaged library",
            },
          })
        : route.fulfill({ status: 500, body: "Server error" }),
    );
    await page.goto("/#/sat");
    // The banner appears once the examples have been copied in, which takes a
    // few seconds on a busy machine.
    await expect(page.locator(".banner.error")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(stored(page)).toContainText("120 questions");
  });
});

const tip = (page: Page) =>
  page.getByText("Turn your phone sideways for larger text.");

async function openExampleQuestion(page: Page) {
  await page.goto("/#/sat");
  await page
    .getByRole("group", { name: "Section" })
    .getByText("Reading & Writing")
    .click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByLabel("Original PDF question")).toBeVisible();
}

test.describe("a phone", () => {
  test.use({
    storageState: firstRun,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("held upright is offered the turn-sideways tip; hiding it is remembered", async ({
    page,
  }) => {
    await openExampleQuestion(page);
    await expect(tip(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.getByRole("button", { name: "Hide this tip" }).click();
    await expect(tip(page)).toHaveCount(0);
    // It stays hidden on the next question and after a reload.
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByLabel("Original PDF question")).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
    await page.reload();
    await page
      .getByRole("button", { name: /^Resume practice/ })
      .first()
      .click();
    await expect(page.getByLabel("Original PDF question")).toBeVisible();
    await expect(tip(page)).toHaveCount(0);
  });

  test("on its side has no tip, a larger question, and the answer row in view", async ({
    page,
  }) => {
    await openExampleQuestion(page);
    const image = page.getByLabel("Original PDF question").locator("img");
    await expect(image).toBeVisible();
    const upright = (await image.boundingBox())!.width;
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(tip(page)).toBeHidden();
    const sideways = (await image.boundingBox())!;
    expect(sideways.width).toBeGreaterThan(upright * 2);
    // The compact layout leaves at least a third of the short screen to the question.
    expect(sideways.y).toBeLessThan(130);
    const answers = (await page.getByRole("radio").first().boundingBox())!;
    expect(answers.y + answers.height).toBeLessThanOrEqual(390);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    // Answering still works from the compact row.
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.locator(".feedback")).toBeVisible();
  });
});

test.describe("a narrow desktop window", () => {
  test.use({ storageState: firstRun, viewport: { width: 390, height: 844 } });
  test("is not a phone: no turn-sideways tip", async ({ page }) => {
    await openExampleQuestion(page);
    await expect(tip(page)).toBeHidden();
  });
});

test.describe("the side rail", () => {
  const header = (page: Page) => page.locator("header.app-header");
  const width = async (page: Page) =>
    Math.round((await header(page).boundingBox())!.width);
  const pageLeft = async (page: Page) =>
    Math.round((await page.locator("main.page").boundingBox())!.x);

  test("shrinks to its icons, opens over the page on hover, and remembers the choice", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await loadSample(page);
    expect(await width(page)).toBe(216);
    const openLeft = await pageLeft(page);

    // It shuts at once, even though the pointer is still over it.
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect.poll(() => width(page)).toBe(64);
    await page.mouse.move(900, 400);
    // Shut, the switch shows the current test alone, inside the strip.
    const current = (await page
      .getByRole("button", { name: "Test: SAT" })
      .boundingBox())!;
    expect(current.x + current.width).toBeLessThanOrEqual(64);
    for (const other of ["Switch to PAA", "Switch to TSI"])
      expect(
        (await page.getByRole("button", { name: other }).boundingBox())!.width,
      ).toBe(0);
    // The page slides over to fill the space (220ms); measure once it rests.
    await page.waitForTimeout(400);
    const shutLeft = await pageLeft(page);
    expect(shutLeft).toBeLessThan(openLeft);

    // Hovering opens it over the page: the page itself does not move.
    await header(page).hover();
    await expect.poll(() => width(page)).toBe(216);
    expect(await pageLeft(page)).toBe(shutLeft);
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "What deserves another look?" }),
    ).toBeVisible();
    await page.mouse.move(900, 400);
    await expect.poll(() => width(page)).toBe(64);

    // The keyboard opens it too.
    await page.getByRole("button", { name: "Review", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect.poll(() => width(page)).toBe(216);
    await page.mouse.click(900, 400);

    await page.reload();
    await expect.poll(() => width(page)).toBe(64);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);

    await header(page).hover();
    await page.getByRole("button", { name: "Keep sidebar open" }).click();
    await page.mouse.move(900, 400);
    await expect.poll(() => width(page)).toBe(216);
    // Back on the page it started from, the page sits where it did.
    await page.getByRole("button", { name: "Practice", exact: true }).click();
    await expect.poll(() => pageLeft(page)).toBe(openLeft);
  });

  test("does not slide the page into place when it loads", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await loadSample(page);
    const left = () =>
      page.evaluate(() =>
        Math.round(document.querySelector("main")!.getBoundingClientRect().x),
      );
    // Measure the moment the rail appears: a slide would still be under way.
    await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
    const first = await left();
    await page.waitForTimeout(300);
    expect(await left()).toBe(first);
  });

  test("leaves the top bar on a narrow screen alone", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("sat-rail", "collapsed"));
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Keep sidebar open" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Review", exact: true }),
    ).toBeVisible();
    // Still the full-width top bar (less the scrollbar gutter), not a 64px strip.
    expect(await width(page)).toBeGreaterThan(900);
  });
});
