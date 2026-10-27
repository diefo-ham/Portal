import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";

async function state(page: Page): Promise<StudyData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("sat-study-local");
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise<StudyData>((resolve) => {
      const transaction = db.transaction("state");
      const request = transaction.objectStore("state").get("current");
      request.onsuccess = () => resolve(request.result);
      transaction.oncomplete = () => db.close();
    });
  });
}

async function loadMath(page: Page, size = "2") {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill(size);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});

test("question details return to tools and Help only scrolls when constrained", async ({
  page,
}) => {
  await loadMath(page, "1");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Question details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to Practice tools", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice tools", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Question overview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Back to Practice tools", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Practice tools", exact: true })
    .click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();

  await page.setViewportSize({ width: 1280, height: 1100 });
  await page
    .getByRole("button", {
      name: "Help and keyboard shortcuts",
      exact: true,
    })
    .click();
  const help = page.getByRole("dialog");
  const before = await help.boundingBox();
  await page.getByText("Keyboard shortcuts", { exact: true }).click();
  const after = await help.boundingBox();
  expect(after!.height).toBeGreaterThan(before!.height);
  expect(
    await help.evaluate(
      (element) => element.scrollHeight <= element.clientHeight + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close help" }).click();

  await page.setViewportSize({ width: 390, height: 420 });
  await page
    .getByRole("button", {
      name: "Help and keyboard shortcuts",
      exact: true,
    })
    .click();
  const compact = await help.boundingBox();
  expect(compact!.y).toBeGreaterThanOrEqual(0);
  expect(compact!.y + compact!.height).toBeLessThanOrEqual(420);
  expect(
    await help.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
});

test("timer and correct-explanation preferences apply to new sessions", async ({
  page,
}) => {
  await loadMath(page, "1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Timer on by default")).toBeChecked();
  await expect(
    page.getByLabel("Show explanations after correct answers"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByLabel("Time on this question")).toBeVisible();
  await page.keyboard.press("b");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await expect(page.getByText(/Subtract 7 from both sides/)).not.toBeVisible();
  await page.getByText("View explanation", { exact: true }).click();
  await expect(page.getByText(/Subtract 7 from both sides/)).toBeVisible();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Timer on by default").uncheck();
  await page.getByLabel("Show explanations after correct answers").check();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Timer on by default")).not.toBeChecked();
  await expect(
    page.getByLabel("Show explanations after correct answers"),
  ).toBeChecked();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByLabel("Time on this question")).toHaveCount(0);
  const sessions = (await state(page)).sessions;
  expect(sessions.map((session) => session.timerVisible)).toEqual([
    true,
    false,
  ]);
  await page.keyboard.press("b");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Subtract 7 from both sides/)).toBeVisible();
});

test("E bookmarks, B remains answer B, and Review uses answered denominators", async ({
  page,
}) => {
  await loadMath(page, "3");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("article")).toBeFocused();
  await page.keyboard.press("e");
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByLabel("Your numeric answer").fill("27");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "All SAT practice: 50% accuracy across 2 attempts",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".performance-gauge")).toContainText("2 attempts");
  await expect(
    page.getByText("1 correct · 1 incorrect", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "1 correct and 1 incorrect across 2 attempts.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Unanswered questions are not counted/),
  ).toBeVisible();
});

test("Review has a truthful empty state before any answer is submitted", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "All SAT practice: not attempted, 0 attempts",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".domain-row")).toHaveCount(8);
  await expect(
    page.getByText("Not attempted", { exact: true }).first(),
  ).toBeVisible();
});
