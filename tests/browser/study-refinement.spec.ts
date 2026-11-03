import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";
import { loadSample } from "./seed";

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
  await loadSample(page);
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill(size);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
});

test("question details return to tools and Help stays usable at tall and constrained sizes", async ({
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
  const overview = help.getByLabel("SAT Study overview");
  for (const area of ["Practice", "Review", "Browse", "Tests"])
    await expect(overview).toContainText(area);
  await expect(help.locator("details[open]")).toHaveCount(0);
  await expect(help).toContainText("Protect active questions");
  await expect(help).not.toContainText("Practice-test question protection");
  const before = await help.boundingBox();
  await page.getByText("Keyboard shortcuts", { exact: true }).click();
  const after = await help.boundingBox();
  expect(after!.height).toBeGreaterThan(before!.height);
  expect(after!.y).toBeGreaterThanOrEqual(0);
  expect(after!.y + after!.height).toBeLessThanOrEqual(1100);
  const shortcuts = help.locator("details").filter({
    hasText: "Keyboard shortcuts",
  });
  const tests = help.locator("details").filter({ hasText: /^Tests/ });
  await expect(shortcuts).toHaveAttribute("open", "");
  await tests.getByText("Tests", { exact: true }).click();
  await expect(tests).toHaveAttribute("open", "");
  await expect(shortcuts).not.toHaveAttribute("open", "");
  await expect(tests).toContainText("Mark for Review");
  await expect(tests).toContainText("only a live-test aid");
  const protection = help.locator("details").filter({
    hasText: /^Protect active questions/,
  });
  await protection
    .getByText("Protect active questions", { exact: true })
    .click();
  await expect(protection).toHaveAttribute("open", "");
  await expect(tests).not.toHaveAttribute("open", "");
  await expect(protection).toContainText("ordinary Practice");
  await expect(protection).toContainText("Tests intentionally use active");
  await page.getByRole("button", { name: "Close help" }).click();

  await page
    .getByRole("button", {
      name: "Help and keyboard shortcuts",
      exact: true,
    })
    .click();
  await expect(help.locator("details[open]")).toHaveCount(0);
  await help.dispatchEvent("click");
  await expect(help).not.toBeVisible();

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
  // A key sent just as the screen appears can be lost; press until B is chosen
  // (never when it already is, since the key toggles). Enter submits that choice.
  const choiceB = page.getByRole("radio").nth(1);
  await expect(async () => {
    if (!(await choiceB.isChecked())) await page.keyboard.press("b");
    await expect(choiceB).toBeChecked({ timeout: 1000 });
  }).toPass();
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
  // Reload restores the default size of ten; one sample item is already answered.
  await page.getByRole("textbox", { name: "Session size" }).fill("1");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByLabel("Time on this question")).toHaveCount(0);
  const sessions = (await state(page)).sessions;
  expect(sessions.map((session) => session.timerVisible)).toEqual([
    true,
    false,
  ]);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page
    .getByRole("button", {
      name: /Resume practice:.*Linear equations in one variable/,
    })
    .click();
  await expect(page.getByText(/Subtract 7 from both sides/)).toBeVisible();
});

test("timing accumulates only during active Practice and survives resume", async ({
  page,
}) => {
  await loadMath(page, "1");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page.getByLabel("Show timer", { exact: true }).click();
  await expect(
    page.getByLabel("Show timer", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();

  const exited = await state(page);
  const sessionId = exited.sessions[0].id;
  const questionId = exited.sessions[0].questionIds[0];
  const beforeClosedWait = exited.sessions[0].elapsed[questionId];
  expect(beforeClosedWait).toBeGreaterThan(700);
  expect(exited.sessions[0].timerVisible).toBe(false);
  await page.waitForTimeout(600);
  expect(
    (await state(page)).sessions.find((session) => session.id === sessionId)!
      .elapsed[questionId],
  ).toBe(beforeClosedWait);

  await page.getByRole("button", { name: /Resume practice:/ }).click();
  await expect(page.getByLabel("Time on this question")).not.toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page.getByRole("button", { name: "Pause timer" }).click();
  const paused = await state(page);
  const pausedAt = paused.sessions.find((session) => session.id === sessionId)!
    .elapsed[questionId];
  await page.waitForTimeout(600);
  // The last tick can still be saved just after the click; what matters is that
  // time stopped counting, which 600 ms of waiting would otherwise exceed.
  expect(
    (await state(page)).sessions.find((session) => session.id === sessionId)!
      .elapsed[questionId] - pausedAt,
  ).toBeLessThan(450);
  await page.getByRole("button", { name: "Resume timer" }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("article").focus();
  await page.keyboard.press("b");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();

  const submitted = await state(page);
  const stored = submitted.sessions.find(
    (session) => session.id === sessionId,
  )!;
  const attempt = submitted.attempts.find(
    (candidate) => candidate.sessionId === sessionId,
  )!;
  // The session's elapsed time can run a tick past the attempt before it stops
  // (more on a loaded machine), but never by anything like the 600 ms waited below.
  await expect
    .poll(async () => {
      const latest = (await state(page)).sessions.find(
        (session) => session.id === sessionId,
      )!;
      return Math.round(latest.elapsed[questionId]) - attempt.durationMs;
    })
    .toBeLessThan(450);
  const submittedAt = (await state(page)).sessions.find(
    (session) => session.id === sessionId,
  )!.elapsed[questionId];
  await page.waitForTimeout(600);
  expect(
    (await state(page)).sessions.find((session) => session.id === sessionId)!
      .elapsed[questionId],
  ).toBe(submittedAt);
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
    page.getByText("No attempts yet", { exact: true }),
  ).toBeVisible();
});
