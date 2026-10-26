import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";

async function state(page: Page): Promise<StudyData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<StudyData>((resolve, reject) => {
        const r = db.transaction("state").objectStore("state").get("current");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  });
}

test("new sessions sample the filtered pool, avoid repeats, and resume the exact saved order", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("math");
  await page.getByRole("combobox", { name: "Session size" }).selectOption("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  const first = (await state(page)).sessions.at(-1)!;
  expect(first.questionIds).toHaveLength(5);
  const corpus = (await state(page)).questions;
  expect(
    first.questionIds.every((id) =>
      corpus.some(
        (q) => q.id === id && q.section === "math" && q.testStatus !== "active",
      ),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open question overview" }).click();
  await page
    .getByRole("button", { name: "Go to question 3", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  const resumed = (await state(page)).sessions.at(-1)!;
  expect(resumed.id).toBe(first.id);
  expect(resumed.questionIds).toEqual(first.questionIds);
  expect(resumed.index).toBe(2);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption("math");
  await page.getByRole("combobox", { name: "Session size" }).selectOption("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  const second = (await state(page)).sessions.at(-1)!;
  expect(second.id).not.toBe(first.id);
  expect(second.questionIds).not.toEqual(first.questionIds);
  expect([...second.questionIds].sort()).toEqual([...first.questionIds].sort());
});

test("confirmed progress reset preserves the bank and preferences across reload; cancel changes nothing", async ({
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
  await page.getByRole("button", { name: "Start practice" }).click();
  await page
    .getByRole("button", { name: "Bookmark question", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByLabel("Your numeric answer").fill("99");
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Protect unused practice-test questions").uncheck();
  await expect(
    page.getByRole("button", { name: "Reset study progress", exact: true }),
  ).toBeVisible();
  const before = await state(page);
  expect(before.attempts).toHaveLength(1);
  expect(before.sessions).toHaveLength(2);
  expect(before.sessions.some((s) => !s.finishedAt)).toBe(true);
  expect(before.annotations["demo-m01"].bookmarked).toBe(true);
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your question bank and interface preferences will remain available",
  );
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Also clear bookmarks")).not.toBeChecked();
  await page.getByLabel("Also clear bookmarks").check();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await state(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await expect(page.getByLabel("Also clear bookmarks")).not.toBeChecked();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Study progress reset");
  const after = await state(page);
  expect(after.questions).toEqual(before.questions);
  expect(after.imports).toEqual(before.imports);
  expect(after.attempts).toEqual([]);
  expect(after.sessions).toEqual([]);
  expect(after.annotations).toEqual({
    "demo-m01": { bookmarked: true, note: "" },
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume practice" }),
  ).toHaveCount(0);
  expect((await state(page)).sessions).toEqual([]);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByLabel("Protect unused practice-test questions"),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page.getByLabel("Also clear bookmarks").check();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).annotations).toEqual({});
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  // Return to protected questions before practicing, without changing the saved preference.
  await page.getByText("Refine selection", { exact: true }).click();
  await page
    .getByLabel("Protect practice-test questions", { exact: true })
    .check();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(
    page.getByRole("button", { name: "Practice tools" }),
  ).toBeVisible();
});
