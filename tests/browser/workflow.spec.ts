import { test, expect, chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
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
    .getByRole("combobox", { name: "Practice-test status", exact: true })
    .selectOption("only");
  await expect(page.locator(".question-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("math");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(
    page.getByText("Not quite. Let’s work through it."),
  ).toBeVisible();
  await expect(page.getByText(/Subtract 7 from both sides/)).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByLabel("My notes")).not.toBeVisible();
  await expect(page.getByLabel("Time on this question")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Bookmark question", exact: true })
    .click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page.getByLabel("My notes").fill("Subtract before dividing.");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((r) => {
          const q = indexedDB.open("sat-study-local");
          q.onsuccess = () => r(q.result);
        });
        return await new Promise((r) => {
          const q = db.transaction("state").objectStore("state").get("current");
          q.onsuccess = () => r(q.result.annotations["demo-m01"]?.note);
        });
      }),
    )
    .toBe("Subtract before dividing.");
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  await expect(page.getByLabel("My notes")).toHaveValue(
    "Subtract before dividing.",
  );
  await page.getByRole("button", { name: "Close panel" }).click();
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
    page.getByRole("button", { name: "Practice these 1 mistakes again" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Review mistakes →", exact: true })
    .click();
  await expect(page.locator(".question-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Library & maintenance", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup" }).click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
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
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await expect(
    page.getByText("0 questions imported. 12 duplicates skipped."),
  ).toBeVisible();
  expect(remote).toEqual([]);
});
test("progress survives closing and reopening the browser process", async ({}, testInfo) => {
  const profile = testInfo.outputPath("browser-profile");
  mkdirSync(profile, { recursive: true });
  let context = await chromium.launchPersistentContext(profile, {
    channel: "msedge",
    headless: true,
  });
  try {
    let page = await context.newPage();
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
test("import validation preserves library and supports narrow screens", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Library & maintenance", { exact: true }).click();
  await page.getByLabel("Import question JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":1,"questions":[{"id":"bad"}]}'),
  });
  await expect(page.getByRole("alert")).toContainText("section must be");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start practice" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
