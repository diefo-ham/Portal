import { expect, test, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";

async function state(page: Page): Promise<StudyData> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sat-study-local");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<StudyData>((resolve, reject) => {
        const request = database
          .transaction("state")
          .objectStore("state")
          .get("current");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  });
}

test("sessions can be named, starred, found, repracticed, and reset-restored", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("math");
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();

  const continueArea = page.getByRole("region", {
    name: "Continue unfinished practice",
  });
  await expect(continueArea).toContainText("Math");
  await expect(continueArea).toContainText("2 questions");
  await expect(page.getByRole("heading", { name: "Starred" })).toHaveCount(0);

  const actions = continueArea.getByRole("button", {
    name: /^Session actions for/,
  });
  await actions.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).not.toBeVisible();
  await expect(actions).toBeFocused();
  await actions.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const name = page.getByRole("textbox", { name: "Session name" });
  await expect(name).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(name).not.toBeVisible();
  await expect(actions).toBeFocused();
  await actions.click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await name.fill("  Hard   Algebra Drill ✓  ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(continueArea).toContainText("Hard Algebra Drill ✓");
  await continueArea
    .getByRole("button", { name: "Star session Hard Algebra Drill ✓" })
    .click();
  expect((await state(page)).sessions[0]).toMatchObject({
    name: "Hard Algebra Drill ✓",
    starred: true,
  });

  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Unstar session Hard Algebra Drill ✓",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Starred" })).toHaveCount(0);
  await page
    .getByRole("button", { name: /Resume practice: Hard Algebra Drill ✓/ })
    .click();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await page.getByRole("button", { name: "← Back to practice" }).click();

  const starred = page.getByRole("region", { name: "Starred" });
  await expect(starred).toContainText("Hard Algebra Drill ✓");
  await expect(
    page.getByRole("region", { name: "Continue unfinished practice" }),
  ).toHaveCount(0);
  await starred
    .getByRole("button", { name: /Session actions for Hard Algebra Drill/ })
    .click();
  await page.getByRole("menuitem", { name: "Practice again" }).click();

  let saved = await state(page);
  expect(saved.sessions).toHaveLength(2);
  expect(saved.sessions[0]).toMatchObject({
    name: "Hard Algebra Drill ✓",
    starred: true,
  });
  expect(saved.sessions[0].finishedAt).toBeTruthy();
  expect(saved.sessions[1]).toMatchObject({
    name: "Hard Algebra Drill ✓ — Repractice",
  });
  expect(saved.sessions[1].finishedAt).toBeUndefined();
  expect(saved.sessions[1].id).not.toBe(saved.sessions[0].id);

  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page
    .getByRole("button", {
      name: /Session actions for Hard Algebra Drill ✓ — Repractice/,
    })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Session name" }).fill("   ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  saved = await state(page);
  expect(saved.sessions[1].name).toBeUndefined();

  await page.getByText("View all sessions (2)", { exact: true }).click();
  await page.getByRole("searchbox", { name: "Search sessions" }).fill("Hard");
  await expect(
    page.locator(".session-history-list .study-session-row"),
  ).toHaveCount(1);
  await page.screenshot({
    path: "private-data/inspection/session-management.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  expect((await state(page)).sessions).toEqual([]);
  await page
    .getByRole("button", { name: "Restore previous study state", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  const restored = await state(page);
  expect(restored.sessions).toHaveLength(2);
  expect(restored.sessions[0]).toMatchObject({
    name: "Hard Algebra Drill ✓",
    starred: true,
  });
});
