import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";
import { mkdirSync } from "node:fs";
import { loadSample } from "./seed";

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
  await loadSample(page);
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
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
  const rows = page.locator(".continue-area .study-session-row");
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
  await page.keyboard.press("e");
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
  await page.getByLabel("Your numeric answer").fill("e");
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
  await page.keyboard.press("e");
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

test("a reset is final: it keeps bookmarks unless asked, offers no restore, and an old archive is removed", async ({
  page,
}) => {
  await setup(page);
  await page.keyboard.press("b");
  // E bookmarks the question, so there is a bookmark for the reset to keep.
  await page.keyboard.press("e");
  await page.getByRole("radio").first().check();
  await page.keyboard.press("Enter");
  await expect(page.locator(".feedback")).toBeVisible();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  const restore = page.getByRole("button", {
    name: "Restore previous study state",
  });
  await expect(restore).toHaveCount(0);

  // An earlier version kept a restorable copy of the study state. It is removed
  // on the next load and never offered.
  const archiveKeys = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("sat-study-local");
        r.onsuccess = () => resolve(r.result);
      });
      return new Promise<string[]>((resolve) => {
        const tx = db.transaction("state");
        const r = tx.objectStore("state").getAllKeys();
        r.onsuccess = () =>
          resolve(r.result.map(String).filter((key) => key !== "current"));
        tx.oncomplete = () => db.close();
      });
    });
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("state", "readwrite");
      for (const key of ["reset-archive", "reset-archive-PAA"])
        tx.objectStore("state").put({ format: "sat-study-reset-v1" }, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  });
  expect(await archiveKeys()).toHaveLength(2);
  const before = await state(page);
  expect(Object.values(before.annotations).some((a) => a.bookmarked)).toBe(
    true,
  );
  await page.reload();
  await expect.poll(archiveKeys).toEqual([]);
  expect(await state(page)).toEqual(before);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(restore).toHaveCount(0);

  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("dialog")).toContainText(
    "A reset cannot be undone.",
  );
  await page.keyboard.press("Escape");
  expect((await state(page)).attempts).toEqual(before.attempts);

  // Bookmarks are kept unless the person chooses to clear them.
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Study progress reset");
  const kept = await state(page);
  expect(kept.attempts).toEqual([]);
  expect(kept.sessions).toEqual([]);
  expect(kept.questions).toEqual(before.questions);
  expect(Object.values(kept.annotations).some((a) => a.bookmarked)).toBe(true);
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page.getByLabel("Also clear bookmarks").check();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).annotations).toEqual({});

  // Nothing was set aside by either reset, and the preferences are untouched.
  expect(await archiveKeys()).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(restore).toHaveCount(0);
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("dark");
  await page.screenshot({
    path: "private-data/inspection/refinement-reset.png",
    fullPage: true,
    animations: "disabled",
  });
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
