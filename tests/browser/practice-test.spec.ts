import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";
import { testCorpus } from "../practiceTestFixtures";
import { enterExpression, expectExpression } from "./math-input";
/**
 * Opens or closes the calculator with its shortcut. The key handler is attached
 * a moment after a screen renders, so a key sent in that gap is lost: press again
 * until the calculator is in the wanted state, and never press once it is.
 */
async function calculatorByKey(page: Page, open: boolean) {
  const close = page.getByRole("button", {
    name: "Close calculator",
    exact: true,
  });
  await expect(async () => {
    if ((await close.isVisible()) !== open)
      await page.keyboard.press("Backslash");
    await expect(close).toBeVisible({ visible: open, timeout: 1000 });
  }).toPass();
}
async function read(page: Page): Promise<StudyData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
    });
    const data = await new Promise<StudyData>((resolve) => {
      const r = db.transaction("state").objectStore("state").get("current");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return data;
  });
}
async function write(page: Page, data: StudyData) {
  await page.evaluate(async (data) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put(data, "current");
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, data);
}
async function seed(page: Page, count = 180) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "What would you like to work on?",
      exact: true,
    }),
  ).toBeVisible();
  await write(page, testCorpus(count));
  await page.reload();
  await page.getByRole("button", { name: "Tests", exact: true }).click();
}
async function start(page: Page, selection: string, timing = "untimed") {
  await page.getByLabel("Test selection").selectOption(selection);
  await page
    .getByRole("combobox", { name: "Timing", exact: true })
    .selectOption(timing);
  await page
    .getByRole("button", { name: "Start Practice Test", exact: true })
    .click();
}
async function finish(page: Page) {
  if (
    !(await page
      .getByRole("heading", { name: "Question Overview", exact: true })
      .isVisible())
  ) {
    await page
      .getByRole("button", { name: "Practice tools", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Question overview", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Finish Module", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish module", exact: true })
    .click();
}
async function resume(page: Page) {
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume test", exact: true })
    .first()
    .click();
  const paused = page.getByRole("heading", { name: "Your time is frozen." });
  if (await paused.isVisible().catch(() => false))
    await page
      .getByRole("button", { name: "Resume test", exact: true })
      .click();
}
test("active Practice Tests can be renamed and canceled without recycling exposed questions", async ({
  page,
}) => {
  page.on("dialog", () => {
    throw new Error("Practice Test management must use portal-native dialogs.");
  });
  await seed(page, 27);
  await expect(
    page.getByRole("button", { name: "Tests", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice Test", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start Practice Test", exact: true }),
  ).toBeVisible();
  await start(page, "reading-writing:first");
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  const before = (await read(page)).sessions[0];
  await page
    .getByRole("button", { name: `Practice Test actions for ${before.name}` })
    .click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await page.getByLabel("Test name").fill("October baseline");
  await page.getByRole("button", { name: "Save name" }).click();
  const renamed = (await read(page)).sessions[0];
  expect(renamed.name).toBe("October baseline");
  // Only the name changes (the running timer may add to elapsed time meanwhile).
  expect({ ...renamed, name: before.name, elapsed: before.elapsed }).toEqual(
    before,
  );
  await resume(page);

  await page.getByRole("button", { name: "Practice tools" }).click();
  await page.getByRole("button", { name: "Cancel Practice Test" }).click();
  await expect(
    page.getByRole("heading", { name: "Cancel Practice Test?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep test" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Practice tools" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Practice tools" }).click();
  await page.getByRole("button", { name: "Cancel Practice Test" }).click();
  await page.getByRole("button", { name: "Cancel Practice Test" }).click();
  await expect(
    page.getByRole("heading", { name: "A test, at your pace." }),
  ).toBeVisible();
  const canceled = await read(page);
  expect(canceled.sessions).toEqual([]);
  expect(canceled.attempts).toEqual([]);
  expect(canceled.practiceTestUsedIds).toHaveLength(27);
  await page.getByLabel("Test selection").selectOption("reading-writing:first");
  await expect(
    page.getByRole("button", { name: "Start Practice Test" }),
  ).toBeDisabled();
});

test("Practice tools keeps overview and omits redundant finish and live rename actions", async ({
  page,
}) => {
  await seed(page);
  await start(page, "reading-writing:first");
  await page
    .getByRole("button", { name: "Practice tools", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Question overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Review and finish module",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Finish module", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Rename Practice Test", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Question details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel Practice Test", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Keyboard shortcuts & help", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Question overview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Question Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("27 unanswered", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Finish Module", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish module", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice Test results", exact: true }),
  ).toBeVisible();
});

test("Your Practice Tests keeps View results primary and renames or deletes completed tests safely", async ({
  page,
}) => {
  await seed(page);
  await start(page, "math:first");
  await finish(page);
  const before = (await read(page)).sessions[0];
  await page.getByRole("button", { name: "Back to Practice Test" }).click();
  await page
    .getByRole("button", { name: `Practice Test actions for ${before.name}` })
    .click();
  await expect(
    page.getByRole("button", { name: "View results" }),
  ).toBeVisible();
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
    "Rename",
    "Delete test",
  ]);
  await expect(page.getByRole("menuitem", { name: "Cancel test" })).toHaveCount(
    0,
  );
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Test name").fill("Completed benchmark");
  await page.getByRole("button", { name: "Save name" }).click();
  const renamed = (await read(page)).sessions[0];
  expect(renamed.name).toBe("Completed benchmark");
  // Only the name changes (the running timer may add to elapsed time meanwhile).
  expect({ ...renamed, name: before.name, elapsed: before.elapsed }).toEqual(
    before,
  );
  const exposed = [...(await read(page)).practiceTestUsedIds];
  await page
    .getByRole("button", {
      name: "Practice Test actions for Completed benchmark",
    })
    .click();
  await page.getByRole("menuitem", { name: "Delete test" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete this completed test?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete test" }).click();
  const deleted = await read(page);
  expect(deleted.sessions).toEqual([]);
  expect(deleted.attempts).toEqual([]);
  expect(deleted.practiceTestUsedIds).toEqual(exposed);
});

test("Your Practice Tests uses divided responsive rows with intact actions", async ({
  page,
}) => {
  await seed(page);
  await start(page, "math:first");
  await finish(page);
  await page.getByRole("button", { name: "Back to Practice Test" }).click();
  await start(page, "reading-writing:first");
  await page.getByRole("button", { name: "← Exit", exact: true }).click();

  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  const active = rows.filter({
    has: page.getByRole("button", { name: "Resume test", exact: true }),
  });
  const completed = rows.filter({
    has: page.getByRole("button", { name: "View results", exact: true }),
  });
  await expect(active).toHaveCount(1);
  await expect(completed).toHaveCount(1);
  await expect(active).toHaveCSS("border-bottom-style", "solid");
  await expect(completed).toHaveCSS("border-bottom-style", "solid");

  await active.getByRole("button", { name: /Practice Test actions/ }).click();
  await expect(active.getByRole("menuitem")).toHaveText([
    "Rename",
    "Cancel test",
  ]);
  await active.getByRole("button", { name: /Practice Test actions/ }).click();
  await completed
    .getByRole("button", { name: /Practice Test actions/ })
    .click();
  await expect(completed.getByRole("menuitem")).toHaveText([
    "Rename",
    "Delete test",
  ]);
  await expect(
    completed.getByRole("menuitem", { name: "Delete test" }),
  ).toHaveCSS("border-top-style", "solid");

  await page.setViewportSize({ width: 390, height: 760 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const copyBox = await active.locator(".practice-test-row-copy").boundingBox();
  const actionsBox = await active
    .locator(".practice-test-row-actions")
    .boundingBox();
  expect(actionsBox!.y).toBeGreaterThanOrEqual(copyBox!.y + copyBox!.height);
});
test("standalone stopwatch, shared answering, map, calculator, resume and scored results", async ({
  page,
}) => {
  await seed(page);
  await start(page, "math:higher");
  await expect(
    page.getByLabel("Module elapsed time", { exact: true }),
  ).toHaveText(/0:0\d/);
  await expect(
    page.getByRole("button", { name: "Check answer", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Simulated unscored", { exact: true }),
  ).toHaveCount(0);
  const a = page.getByRole("radio", { name: "A One" });
  await a.click();
  await expect(a).toBeChecked();
  await a.click();
  await expect(a).not.toBeChecked();
  await page.keyboard.press("a");
  await expect(a).toBeChecked();
  await page
    .getByRole("button", { name: "Mark for review", exact: true })
    .click();
  await expect(a).toBeEnabled();
  await calculatorByKey(page, true);
  await calculatorByKey(page, false);
  await expect(
    page.getByRole("button", { name: "Close calculator", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Next question →", exact: true })
    .click();
  await page.getByRole("radio", { name: "B Two" }).click();
  await page
    .getByRole("button", { name: "Open question overview", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Go to question 1, answered, marked for review",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Go to question.*correct/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Go to question 1, answered, marked for review",
      exact: true,
    })
    .click();
  const before = (await read(page)).sessions[0];
  await page.reload();
  await resume(page);
  await expect(page.getByRole("radio", { name: "A One" })).toBeChecked();
  const resumed = (await read(page)).sessions[0];
  expect(resumed.practiceTest).toEqual(before.practiceTest);
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Practice Test results" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /20 total scored questions/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Estimated SAT range", exact: true })
    .click();
  await expect(page.getByText(/\/ 800/).first()).toBeVisible();
  await expect(
    page.getByText("Unofficial practice estimate", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/Actual scored accuracy:/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Domains & skills" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calculator workspace" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: /Marked for Review/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Marked for Review during this test/),
  ).toHaveCount(0);
  expect((await read(page)).sessions[0].practiceTest!.markedForReview).toEqual(
    [],
  );
  await page
    .getByRole("combobox", { name: "Show", exact: true })
    .selectOption("incorrect");
  expect((await read(page)).attempts).toHaveLength(2);
});
test("timed expiry ends the module, preserves answers, and uses persisted clocks after reopening", async ({
  page,
}) => {
  await seed(page);
  await start(page, "reading-writing:first", "timed");
  await expect(page.getByLabel("Module time remaining")).toHaveText(
    /31:5\d|32:00/,
  );
  await page.getByRole("radio", { name: "A One" }).click();
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  const d = await read(page);
  d.sessions[0].practiceTest!.modules[0].startedAt =
    Date.now() - 32 * 60_000 - 1000;
  d.sessions[0].practiceTest!.modules[0].pausedAt = Date.now();
  await write(page, d);
  await page.reload();
  await resume(page);
  await expect(
    page.getByRole("heading", { name: "Practice Test results" }),
  ).toBeVisible();
  const completed = await read(page);
  expect(completed.attempts).toHaveLength(1);
  expect(completed.sessions[0].practiceTest!.modules[0].durationMs).toBe(
    32 * 60_000,
  );
  await expect(
    page.getByRole("img", { name: /25 total scored questions/ }),
  ).toBeVisible();
});
test("pause freezes both clocks, blocks the test surface, survives reload, and leaving auto-pauses", async ({
  page,
}) => {
  await seed(page);
  await page.clock.install({ time: new Date() });
  await start(page, "math:first", "timed");
  const timedClock = page.getByLabel("Module time remaining");
  await expect(timedClock).toHaveText(/34:5\d|35:00/);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const frozenCountdown = await timedClock.textContent();
  await expect(
    page.getByRole("heading", { name: "Your time is frozen." }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "A One" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next question →", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Calculator", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward("05:00");
  await expect(timedClock).toHaveText(frozenCountdown!);
  await page.reload();
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume test", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your time is frozen." }),
  ).toBeVisible();
  await expect(timedClock).toHaveText(frozenCountdown!);
  await page.getByRole("button", { name: "Resume test", exact: true }).click();
  expect(
    (await read(page)).sessions[0].practiceTest!.modules[0].pausedMs,
  ).toBeGreaterThanOrEqual(5 * 60_000);
  await page.clock.fastForward("00:01");
  await expect(timedClock).not.toHaveText(frozenCountdown!);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A test, at your pace." }),
  ).toBeVisible();
  expect((await read(page)).sessions[0].paused).toBe(true);

  await start(page, "math:first", "untimed");
  const stopwatch = page.getByLabel("Module elapsed time");
  await page.clock.fastForward("00:03");
  // The display catches up with the clock a moment later; pause only after it has.
  await expect(stopwatch).not.toHaveText("0:00");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your time is frozen." }),
  ).toBeVisible();
  const frozen = await stopwatch.textContent();
  await page.clock.fastForward("02:00");
  await expect(stopwatch).toHaveText(frozen!);
  await page.getByRole("button", { name: "Resume test", exact: true }).click();
  await page.clock.fastForward("00:01");
  await expect(stopwatch).not.toHaveText(frozen!);
});
test("review marks stay local, persist in the full-page overview, and finish uses a portal modal", async ({
  page,
}) => {
  await seed(page);
  page.on("dialog", () => {
    throw new Error(
      "Practice Test finish must not use a browser-native dialog.",
    );
  });
  await start(page, "reading-writing:first");
  await page.getByRole("button", { name: "Mark for review" }).click();
  await page.getByRole("button", { name: "Next question →" }).click();
  await page.getByRole("radio", { name: "A One" }).click();
  await page.getByRole("button", { name: "Mark for review" }).click();
  await page
    .getByRole("button", { name: "Open question overview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Question Overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".test-question-grid strong").first()).toHaveText(
    "1",
  );
  await expect(
    page.getByRole("button", {
      name: "Go to question 1, unanswered, marked for review",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Go to question 2, answered, marked for review",
      exact: true,
    }),
  ).toBeVisible();
  expect((await read(page)).annotations).toEqual({});
  await page.reload();
  await resume(page);
  await expect(
    page.getByRole("heading", { name: "Question Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Go to question 1, unanswered, marked for review",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Unmark for review" }).click();
  await page
    .getByRole("button", { name: "Open question overview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finish Module", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish Module" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Finish Reading and Writing — Module 1?",
    }),
  ).toBeVisible();
  await expect(page.getByText("26 questions are unanswered.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Question Overview", exact: true }),
  ).toBeVisible();
  expect((await read(page)).sessions[0].practiceTest!.phase).toBe("module");
  await page.getByRole("button", { name: "Finish Module" }).click();
  await page
    .getByRole("button", { name: "Finish module", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice Test results" }),
  ).toBeVisible();
  expect((await read(page)).annotations).toEqual({});
  expect((await read(page)).sessions[0].practiceTest!.markedForReview).toEqual(
    [],
  );
});
test("full test routes and locks modules, resumes the break, skips early, and completes 98 unique items", async ({
  page,
}) => {
  await seed(page);
  await start(page, "full");
  let d = await read(page);
  d.sessions[0].questionIds.forEach((id) => (d.sessions[0].drafts[id] = "A"));
  await write(page, d);
  await page.reload();
  await resume(page);
  await finish(page);
  await expect(
    page.getByText("Reading and Writing · Module 2", { exact: true }),
  ).toBeVisible();
  d = await read(page);
  expect(d.sessions[0].practiceTest!.routes["reading-writing"]).toBe("higher");
  await page
    .getByRole("button", { name: "Open question overview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Go to question/ }),
  ).toHaveCount(27);
  await page.getByRole("button", { name: /^Go to question 1,/ }).click();
  await expect(page.getByRole("article")).toBeVisible();
  await page.reload();
  await resume(page);
  expect(
    (await read(page)).sessions[0].practiceTest!.routes["reading-writing"],
  ).toBe("higher");
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "A moment to pause." }),
  ).toBeVisible();
  await expect(page.getByLabel("Break remaining")).toHaveText(/9:5\d|10:00/);
  const breakStart = (await read(page)).sessions[0].practiceTest!
    .breakStartedAt;
  await page.reload();
  await resume(page);
  expect((await read(page)).sessions[0].practiceTest!.breakStartedAt).toBe(
    breakStart,
  );
  await page.getByRole("button", { name: "Skip break and start Math" }).click();
  await expect(
    page.getByText("Math · Module 1", { exact: true }),
  ).toBeVisible();
  await calculatorByKey(page, true);
  await enterExpression(page, 1, "y=x^2-4");
  await calculatorByKey(page, false);
  await finish(page);
  await expect(
    page.getByText("Math · Module 2", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Backslash");
  await expectExpression(page, 1, "y=x^2-4");
  await page.keyboard.press("Backslash");
  await finish(page);
  await expect(
    page.getByRole("heading", { name: "Practice Test results" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /90 total scored questions/ }),
  ).toBeVisible();
  d = await read(page);
  expect(d.sessions[0].questionIds).toHaveLength(98);
  expect(new Set(d.sessions[0].questionIds).size).toBe(98);
  const mathDomains = page
    .locator("#test-domain-math")
    .locator("..")
    .locator(".domain-row");
  const rwDomains = page
    .locator("#test-domain-reading-writing")
    .locator("..")
    .locator(".domain-row");
  const mathA = mathDomains.nth(0);
  const mathB = mathDomains.nth(1);
  const rwA = rwDomains.nth(0);
  const rwB = rwDomains.nth(1);
  await mathA.locator("summary").click();
  await expect(mathA).toHaveAttribute("open", "");
  await rwA.locator("summary").click();
  await expect(mathA).toHaveAttribute("open", "");
  await expect(rwA).toHaveAttribute("open", "");
  await mathB.locator("summary").click();
  await expect(mathA).not.toHaveAttribute("open", "");
  await expect(mathB).toHaveAttribute("open", "");
  await expect(rwA).toHaveAttribute("open", "");
  await rwB.locator("summary").click();
  await expect(rwA).not.toHaveAttribute("open", "");
  await expect(rwB).toHaveAttribute("open", "");
  await expect(mathB).toHaveAttribute("open", "");
  await expect(mathB.locator("summary")).toContainText(/%.*attempted/);
  await expect(mathB.locator(".skill-performance")).toContainText(/Skill/);
  await expect(
    page.getByRole("heading", {
      name: "Reading & Writing — Module 2, Higher Difficulty",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Math — Module 2, Lower Difficulty" }),
  ).toBeVisible();
  const firstReviewModule = page.getByRole("button", {
    name: /Reading & Writing — Module 1.*shown/,
  });
  const lastReviewModule = page.getByRole("button", {
    name: /Math — Module 2, Lower Difficulty.*shown/,
  });
  await expect(firstReviewModule).toHaveAttribute("aria-expanded", "true");
  await lastReviewModule.click();
  await expect(firstReviewModule).toHaveAttribute("aria-expanded", "false");
  await expect(lastReviewModule).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Math", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /40 total scored questions/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reading & Writing", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /50 total scored questions/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overall", exact: true }).click();
  await page
    .getByRole("button", { name: "Estimated SAT range", exact: true })
    .click();
  await expect(page.getByText(/\/ 1600/)).toBeVisible();
  await expect(page.getByText(/R&W \/ 800/)).toBeVisible();
  await expect(page.getByText(/Math \/ 800/)).toBeVisible();
});
test("exhaustion blocks recycling, and reset recovery restores the exposure ledger", async ({
  page,
}) => {
  await seed(page, 27);
  await start(page, "reading-writing:lower");
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByLabel("Test selection").selectOption("reading-writing:first");
  await expect(
    page.getByRole("button", { name: "Start Practice Test" }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("0 available");
  await page.getByRole("button", { name: "Open reset settings" }).click();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  expect((await read(page)).practiceTestUsedIds).toEqual([]);
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page.getByLabel("Test selection").selectOption("reading-writing:first");
  await expect(
    page.getByRole("button", { name: "Start Practice Test" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore previous study state" })
    .click();
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  expect((await read(page)).practiceTestUsedIds).toHaveLength(27);
});
test("live timed countdown advances automatically and untimed stopwatch never expires", async ({
  page,
}) => {
  await seed(page);
  await page.clock.install({ time: new Date() });
  await start(page, "full", "timed");
  await page.getByRole("radio", { name: "A One" }).click();
  await expect
    .poll(async () => Object.keys((await read(page)).sessions[0].drafts).length)
    .toBe(1);
  await page.clock.fastForward("32:00");
  await expect(
    page.getByText("Reading and Writing · Module 2", { exact: true }),
  ).toBeVisible();
  let d = await read(page);
  expect(d.attempts).toHaveLength(1);
  expect(d.sessions[0].practiceTest!.modules[0].durationMs).toBe(32 * 60_000);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await start(page, "math:first", "untimed");
  await expect(
    page.getByLabel("Module elapsed time", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward("40:00");
  await expect(
    page.getByLabel("Module elapsed time", { exact: true }),
  ).toHaveText("40:00");
  await expect(
    page.getByRole("button", { name: "Next question →", exact: true }),
  ).toBeVisible();
  d = await read(page);
  expect(d.sessions[1].finishedAt).toBeUndefined();
});
test("numeric answers share navigation, and setup and results fit a narrow screen", async ({
  page,
}, testInfo) => {
  await seed(page);
  let d = await read(page);
  d.questions.forEach((q) => {
    q.answer = { type: "numeric", accepted: ["0.5"] };
    delete q.choices;
  });
  await write(page, d);
  await page.reload();
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("setup.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await start(page, "math:lower");
  await page.getByRole("textbox", { name: "Your numeric answer" }).fill("1/2");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "← Previous", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your numeric answer" }),
  ).toHaveValue("1/2");
  await page.screenshot({
    path: testInfo.outputPath("question-mobile.png"),
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await finish(page);
  await page
    .getByRole("button", { name: "Estimated SAT range", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("results-mobile.png"),
    fullPage: true,
  });
  expect((await read(page)).attempts[0]).toMatchObject({
    answer: "1/2",
    correct: true,
  });
});

test("exact scored percentage stays visible across facets and review retains simulated-unscored mistakes", async ({
  page,
}) => {
  await seed(page);
  await start(page, "math:lower");
  const d = await read(page),
    s = d.sessions[0],
    m = s.practiceTest!.modules[0];
  const scored = m.questionIds.filter((id) => !m.unscoredIds.includes(id));
  scored.slice(0, 10).forEach((id) => (s.drafts[id] = "A"));
  scored.slice(10, 15).forEach((id) => (s.drafts[id] = "B"));
  m.unscoredIds.forEach((id) => (s.drafts[id] = "B"));
  await write(page, d);
  await page.reload();
  await resume(page);
  await finish(page);
  await expect(
    page.getByRole("img", { name: /50% scored accuracy/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Domain highlights")).toContainText(
    "Strongest domain",
  );
  await expect(page.getByLabel("Domain highlights")).toContainText(
    "Needs the most attention",
  );
  await expect(page.getByText("10", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("· Simulated unscored", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Math — Module 2, Lower Difficulty" }),
  ).toBeVisible();
  await expect(page.locator(".module-result-row > summary")).toContainText(
    "50% · 10/20",
  );
  await expect(
    page.locator(".module-review-questions summary").first(),
  ).toContainText("Q1/22");
  const moduleToggle = page.getByRole("button", {
    name: /Math — Module 2, Lower Difficulty.*shown/,
  });
  await expect(moduleToggle).toHaveAttribute("aria-expanded", "true");
  await moduleToggle.click();
  await expect(moduleToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".module-review-questions > details")).toHaveCount(
    0,
  );
  await moduleToggle.click();
  await page.locator("label.result-filter select").selectOption("unscored");
  await expect(page.locator(".module-review-questions > details")).toHaveCount(
    2,
  );
  await page.locator("label.result-filter select").selectOption("unanswered");
  await expect(page.locator(".module-review-questions > details")).toHaveCount(
    5,
  );
  await page.locator("label.result-filter select").selectOption("all");
  const firstQuestion = page
    .locator(".module-review-questions > details")
    .first();
  await firstQuestion.locator("summary").click();
  await expect(
    firstQuestion.getByText(/Synthetic math question/),
  ).toBeVisible();
  await firstQuestion
    .getByRole("button", { name: "Bookmark question" })
    .click();
  await expect(
    firstQuestion.getByRole("button", { name: "Remove bookmark" }),
  ).toBeVisible();
  expect(
    Object.values((await read(page)).annotations).filter(
      (annotation) => annotation.bookmarked,
    ),
  ).toHaveLength(1);
  const firstDomain = page
    .locator(".test-domain-performance .domain-row")
    .first();
  await firstDomain.locator("summary").click();
  await expect(firstDomain.locator(".skill-performance")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice unanswered (5)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice all questions" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Estimated SAT range", exact: true })
    .click();
  await expect(
    page.getByText("Actual scored accuracy:").locator(".."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Practice mistakes (7)", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice these questions again?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin anyway" }).click();
  await expect(
    page.getByRole("button", { name: "Open question overview", exact: true }),
  ).toContainText("of 7");
  await expect(
    page.getByRole("button", { name: "Check answer", exact: true }),
  ).toBeVisible();
  expect((await read(page)).sessions[1].practiceTest).toBeUndefined();
});
