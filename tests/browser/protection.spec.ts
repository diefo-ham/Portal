import { test, expect, type Page } from "@playwright/test";
import { defaultFilters, type StudyData } from "../../src/core/model";
import {
  beginSession,
  finishSession,
  submitAnswer,
} from "../../src/core/commands";
import { testCorpus } from "../practiceTestFixtures";

function mixedCorpus() {
  const d = testCorpus(54);
  d.questions.forEach((q) => (q.stem = `ACTIVE PROTECTED ${q.id}`));
  for (const status of ["inactive", "unknown"] as const)
    for (let i = 0; i < 4; i++) {
      d.questions.push({
        ...structuredClone(d.questions[54 + i]),
        id: `${status}-${i}`,
        testStatus: status,
        stem: `ALLOWED ${status} ${i}`,
      });
    }
  d.questions.forEach(
    (q) => (d.annotations[q.id] = { bookmarked: true, note: "" }),
  );
  const completed = beginSession(
    d,
    ["math-0", "inactive-0", "unknown-0"],
    { ...defaultFilters, active: "include" },
    "Intentional history",
  );
  completed.questionIds.forEach((id) => submitAnswer(d, completed.id, id, "B"));
  finishSession(d, completed.id);
  beginSession(
    d,
    ["math-1", "inactive-1", "unknown-1"],
    { ...defaultFilters, active: "include" },
    "Intentional saved",
  );
  return d;
}
async function state(page: Page, write?: StudyData): Promise<StudyData> {
  return page.evaluate(async (write) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      if (write)
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(write, "current");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      return await new Promise<StudyData>((resolve, reject) => {
        const r = db.transaction("state").objectStore("state").get("current");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }, write);
}
async function seed(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "What would you like to work on?",
      exact: true,
    }),
  ).toBeVisible();
  const d = mixedCorpus();
  await state(page, d);
  await page.reload();
  await page.getByRole("textbox", { name: "Session size" }).fill("6");
  return d;
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("button", {
      name: name === "Start practice" ? "Start practice →" : name,
      exact: true,
    })
    .click();
}
async function assertNewProtected(page: Page) {
  const d = await state(page),
    s = d.sessions.at(-1)!;
  expect(s.practiceTest).toBeUndefined();
  expect(s.questionIds.length).toBeGreaterThan(0);
  expect(
    s.questionIds.every(
      (id) => d.questions.find((q) => q.id === id)!.testStatus !== "active",
    ),
  ).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "← Exit");
}

test("ordinary Practice, Browse, review and bookmarks exclude active questions while Tests can select them", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "Browse");
  await expect(page.locator(".question-row")).toHaveCount(6);
  await expect(page.locator(".question-list")).not.toContainText(
    "ACTIVE PROTECTED",
  );
  await expect(page.locator(".question-list")).toContainText("ALLOWED unknown");
  await nav(page, "Practice");
  await nav(page, "Start practice");
  await assertNewProtected(page);
  await nav(page, "Review");
  await nav(page, "Practice mistakes");
  await assertNewProtected(page);
  await nav(page, "Review");
  await nav(page, "Practice unanswered");
  await assertNewProtected(page);
  await nav(page, "Review");
  await expect(
    page.getByText(/saved questions are hidden by practice-test protection/),
  ).toBeVisible();
  await nav(page, "Practice bookmarks");
  await assertNewProtected(page);
  await nav(page, "Review");
  await page
    .locator(".domain-row")
    .filter({ hasText: "Domain 0" })
    .first()
    .locator("summary")
    .click();
  await page
    .getByRole("button", { name: "Practice Domain 0", exact: true })
    .first()
    .click();
  await assertNewProtected(page);
  expect((await state(page)).practiceTestUsedIds ?? []).toEqual([]);
  await nav(page, "Tests");
  await page.getByLabel("Test selection").selectOption("math:first");
  await page
    .getByRole("combobox", { name: "Timing", exact: true })
    .selectOption("untimed");
  await nav(page, "Start Practice Test");
  const d = await state(page),
    s = d.sessions.at(-1)!;
  expect(s.questionIds).toHaveLength(22);
  expect(
    s.questionIds.every(
      (id) => d.questions.find((q) => q.id === id)!.testStatus === "active",
    ),
  ).toBe(true);
  expect(d.practiceTestUsedIds).toEqual(expect.arrayContaining(s.questionIds));
});

test("an intentional filter override still warns before Practice or Browse exposes active material", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await seed(page);
  await page.getByText("Refine selection", { exact: true }).click();
  await page
    .getByLabel("Protect practice-test questions", { exact: true })
    .uncheck();
  await nav(page, "Start practice");
  const warning = page.getByRole("dialog", {
    name: "Practice these questions again?",
  });
  await expect(warning).toContainText("active practice-test questions");
  await warning.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(page)).sessions).toHaveLength(2);
  await nav(page, "Browse");
  const active = page
    .locator(".question-row-main")
    .filter({ hasText: "ACTIVE PROTECTED" })
    .first();
  await expect(active).toBeVisible();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("active practice test");
    return dialog.dismiss();
  });
  await active.click();
  await expect(page.locator(".browse-question")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await active.click();
  await expect(page.locator(".browse-question")).toContainText(
    "ACTIVE PROTECTED",
  );
  await nav(page, "← Back to questions");
  await nav(page, "Reset filters");
  await expect(page.locator(".question-list")).not.toContainText(
    "ACTIVE PROTECTED",
  );
  await nav(page, "Settings");
  await expect(
    page.getByLabel("Protect unused practice-test questions"),
  ).toBeChecked();
});

test("saved active sessions preserve order, while Practice Again and result review require explicit confirmation", async ({
  page,
}) => {
  const original = await seed(page);
  await page
    .getByRole("button", { name: /Resume practice: Intentional saved/ })
    .click();
  await expect(page.locator(".question-text")).toContainText(
    "ACTIVE PROTECTED math-1",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).sessions[1].questionIds).toEqual(
    original.sessions[1].questionIds,
  );
  await nav(page, "← Exit");
  await page
    .getByRole("button", {
      name: "Session actions for Intentional history",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Practice again", exact: true })
    .click();
  const warning = page.getByRole("dialog", {
    name: "Practice these questions again?",
  });
  await expect(warning).toContainText("active practice-test questions");
  await warning.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(page)).sessions).toHaveLength(2);
  await nav(page, "Review");
  await page
    .getByRole("button", { name: /Intentional history.*correct.*incorrect/ })
    .click();
  await page
    .getByRole("button", { name: "Practice mistakes (3)", exact: true })
    .click();
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Cancel", exact: true }).click();
  await nav(page, "Practice entire session again");
  await expect(warning).toBeVisible();
  await warning
    .getByRole("button", { name: "Begin anyway", exact: true })
    .click();
  const d = await state(page);
  expect(d.sessions).toHaveLength(3);
  expect(d.sessions.at(-1)!.questionIds.slice().sort()).toEqual(
    original.sessions[0].questionIds.slice().sort(),
  );
  expect(d.practiceTestUsedIds ?? []).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem("sat-protect-tests")),
  ).not.toBe("false");
});

test("progress reset and archive recovery keep protected ordinary selection", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "Settings");
  const protection = page.getByLabel("Protect unused practice-test questions");
  await expect(protection).toBeChecked();
  await nav(page, "Reset study progress");
  await nav(page, "Confirm reset");
  await expect(protection).toBeChecked();
  await nav(page, "Practice");
  await nav(page, "Start practice");
  await assertNewProtected(page);
  await nav(page, "Settings");
  await nav(page, "Restore previous study state");
  await nav(page, "Confirm restore");
  await expect(protection).toBeChecked();
  await nav(page, "Practice");
  await nav(page, "Start practice");
  await assertNewProtected(page);
});
