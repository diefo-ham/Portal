import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";
import { mkdirSync } from "node:fs";

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
async function setup(page: Page) {
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
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator("article")).toBeFocused();
}
test("Continue keeps older unfinished sets reachable without exposing a long list", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Start practice" }).click();
    await page.getByRole("button", { name: "← Exit", exact: true }).click();
  }
  const rows = page.locator(".continue-area .resume-strip");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(2)).toBeVisible();
  await expect(rows.nth(3)).not.toBeVisible();
  await page.getByText("More unfinished sets (1)", { exact: true }).click();
  await expect(rows.nth(3)).toBeVisible();
  await rows.nth(3).getByRole("button", { name: "Resume practice" }).click();
  await expect(page.locator("article")).toBeFocused();
  expect(
    (await state(page)).sessions.filter((s) => !s.finishedAt),
  ).toHaveLength(4);
});
test("bookmark pointer and keyboard flow, help, and independent resumable sets", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Bookmark question", exact: true })
    .click();
  await expect(page.locator("article")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await state(page)).annotations["demo-m01"]?.bookmarked)
    .toBe(true);
  await page.keyboard.press("b");
  await expect(
    page.getByRole("button", { name: "Bookmark question", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const star = page.getByRole("button", {
    name: "Bookmark question",
    exact: true,
  });
  await star.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeFocused();
  await page.locator("article").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Your numeric answer")).toBeVisible();
  await page.getByLabel("Your numeric answer").fill("b");
  expect((await state(page)).annotations["demo-m02"]).toBeUndefined();
  await page.getByLabel("Your numeric answer").fill("28");
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  const first = (await state(page)).sessions[0];
  await expect(
    page.getByRole("region", { name: "Continue unfinished practice" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator("article")).toBeFocused();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume practice" }),
  ).toHaveCount(2);
  mkdirSync("private-data/inspection", { recursive: true });
  await page.screenshot({
    path: "private-data/inspection/refinement-continue.png",
    fullPage: true,
    animations: "disabled",
  });
  expect((await state(page)).sessions.every((s) => !s.finishedAt)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).last().click();
  await expect(page.getByLabel("Your numeric answer")).toHaveValue("28");
  const saved = (await state(page)).sessions.find((s) => s.id === first.id)!;
  expect(saved.questionIds).toEqual(first.questionIds);
  expect(saved.index).toBe(first.index);
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page.getByText("Keyboard shortcuts & help", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Toggle the current question’s bookmark",
  );
  await page.keyboard.press("b");
  expect((await state(page)).annotations["demo-m02"]).toBeUndefined();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Practice bookmarks", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove bookmark", exact: true }),
  ).toBeVisible();
  expect((await state(page)).sessions.at(-1)?.questionIds).toEqual([
    "demo-m01",
  ]);
});

test("reset archive recovers progress and bookmarks and a later reset replaces it", async ({
  page,
}) => {
  await setup(page);
  await page.keyboard.press("b");
  await page.getByRole("radio").first().check();
  await page.keyboard.press("Enter");
  await expect(page.locator(".feedback")).toBeVisible();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await expect(
    page.getByRole("button", {
      name: "Restore previous study state",
      exact: true,
    }),
  ).toHaveCount(0);
  const before = await state(page);
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  expect((await state(page)).attempts).toEqual(before.attempts);
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page.getByLabel("Also clear bookmarks").check();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Study progress reset");
  expect((await state(page)).annotations).toEqual({});
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore previous study state", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("replaces your current");
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Previous study state restored",
  );
  const restored = await state(page);
  expect(restored.attempts).toEqual(before.attempts);
  expect(restored.annotations).toEqual(before.annotations);
  expect(restored.sessions).toEqual(
    before.sessions.map((s) => ({ ...s, paused: true })),
  );
  expect(restored.questions).toEqual(before.questions);
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("dark");
  await page.screenshot({
    path: "private-data/inspection/refinement-reset-recovery.png",
    fullPage: true,
    animations: "disabled",
  });
  // Reset once to empty history, then again to replace the old archive with empty history.
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Reset study progress", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm reset", exact: true })
      .click();
    await expect.poll(async () => (await state(page)).attempts.length).toBe(0);
  }
  await page
    .getByRole("button", { name: "Restore previous study state", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Previous study state restored",
  );
  expect((await state(page)).attempts).toEqual([]);
  expect((await state(page)).sessions).toEqual([]);
  expect((await state(page)).annotations).toEqual(before.annotations);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page
    .getByRole("button", { name: "Help and keyboard shortcuts" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Previous / next question",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator("article")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toContainText("Question 2");
});
