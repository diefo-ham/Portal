import { test, expect, chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
// Keep content-specific assertions reproducible; random generation is tested separately.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});
test("offline local workflow, history, reload persistence and backup restore", async ({
  page,
  context,
}) => {
  const remote: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith("http://127.0.0.1:4318") && !url.startsWith("data:")) {
      remote.push(url);
      await route.abort();
    } else await route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByRole("button", { name: /01 Math/ })).toBeVisible();
  await expect(page.locator(".question-row")).toHaveCount(10);
  await page
    .getByLabel("Protect practice-test questions", { exact: true })
    .uncheck();
  await expect(page.locator(".question-row")).toHaveCount(12);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(
    page.getByText("Not quite. Let’s work through it."),
  ).toBeVisible();
  await expect(page.getByText(/Subtract 7 from both sides/)).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByLabel("My notes")).not.toBeVisible();
  await expect(page.getByLabel("Time on this question")).toBeVisible();
  await page
    .getByRole("button", { name: "Bookmark question", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark" }),
  ).toBeVisible();
  await expect(
    page.getByText("Not quite. Let’s work through it."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByLabel("Your numeric answer").fill("28");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Practice mistakes (1)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Practice mistakes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 1 of 1/);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Library & maintenance", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.getByLabel("Theme").selectOption("light");
  await page.getByLabel("Timer on by default").uncheck();
  await page.getByLabel("Restore backup JSON").setInputFiles(path!);
  await expect(
    page.getByText("Replace local data with this backup?"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Replace with backup", exact: true })
    .click();
  await expect(
    page.getByText("Backup restored. Saved session timers are paused."),
  ).toBeVisible();
  await expect(page.getByLabel("Theme")).toHaveValue("auto");
  await expect(page.getByLabel("Timer on by default")).toBeChecked();
  expect(remote).toEqual([]);
});
test("progress survives closing and reopening the browser process", async ({}, testInfo) => {
  // Starts a browser twice; a busy runner can need longer than the default 30 s.
  test.setTimeout(120_000);
  const profile = testInfo.outputPath("browser-profile");
  mkdirSync(profile, { recursive: true });
  let context = await chromium.launchPersistentContext(profile, {
    channel: "msedge",
    headless: true,
  });
  try {
    let page = await context.newPage();
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto("http://127.0.0.1:4318");
    await page
      .getByRole("button", { name: "Load synthetic sample", exact: true })
      .click();
    await page.getByRole("button", { name: "Start practice" }).click();
    await page.getByRole("radio").nth(1).check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
    await context.close();
    context = await chromium.launchPersistentContext(profile, {
      channel: "msedge",
      headless: true,
    });
    page = await context.newPage();
    await page.goto("http://127.0.0.1:4318");
    await page.getByRole("button", { name: "Resume practice" }).click();
    await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
  } finally {
    await context.close();
  }
});
test("question import controls are absent and narrow screens remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Import question JSON")).toHaveCount(0);
  await expect(
    page.getByText("Stored on this device", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".question-row-main").first().click();
  await expect(page.getByLabel("Browse question 1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
