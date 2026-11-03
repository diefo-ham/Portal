import { test, expect, type Page } from "@playwright/test";
import { loadSample } from "./seed";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await loadSample(page);
});

test("Section, Domain, Skill, and Answer Status remain compatible", async ({
  page,
}) => {
  const section = page.getByRole("group", { name: "Section", exact: true });
  await expect(section.getByRole("button", { name: "All" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^Domain:/ }).click();
  let domains = page.getByRole("group", { name: "Domain", exact: true });
  await domains.getByLabel("Craft and Structure", { exact: true }).check();
  await domains.getByRole("button", { name: "Done", exact: true }).click();
  await expect(section.getByRole("button", { name: "All" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Max 1", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Domain: Craft and Structure" })
    .click();
  await domains.getByRole("button", { name: "Clear domain" }).click();
  await domains.getByRole("button", { name: "Done", exact: true }).click();

  await section.getByRole("button", { name: "Math", exact: true }).click();
  await page.getByRole("button", { name: /^Domain:/ }).click();
  domains = page.getByRole("group", { name: "Domain", exact: true });
  await expect(domains.getByLabel("Algebra", { exact: true })).toBeVisible();
  await expect(
    domains.getByLabel("Craft and Structure", { exact: true }),
  ).toHaveCount(0);
  await domains.getByLabel("Algebra", { exact: true }).check();
  await domains.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("Refine selection", { exact: true }).click();
  await page.getByRole("button", { name: /^Skill:/ }).click();
  const skills = page.getByRole("group", { name: "Skill", exact: true });
  await skills.getByLabel("Linear functions", { exact: true }).check();
  await skills.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Max 1", { exact: true })).toBeVisible();

  await section
    .getByRole("button", { name: "Reading & Writing", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Domain: Any" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skill: Any" })).toBeVisible();
  await expect(page.getByText("Max 5", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Answer status: Unanswered" }).click();
  const statuses = page.getByRole("group", {
    name: "Answer status",
    exact: true,
  });
  await expect(
    statuses.getByLabel("Unanswered", { exact: true }),
  ).toBeChecked();
  await expect(
    statuses.getByLabel("Mistakes", { exact: true }),
  ).not.toBeChecked();
  await expect(
    statuses.getByLabel("Completed", { exact: true }),
  ).not.toBeChecked();
  await statuses.getByLabel("Mistakes", { exact: true }).check();
  await statuses.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Answer status: Mistakes, Unanswered",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Max 5", { exact: true })).toBeVisible();

  await page
    .getByRole("button", {
      name: "Answer status: Mistakes, Unanswered",
      exact: true,
    })
    .click();
  await statuses.getByLabel("Mistakes", { exact: true }).uncheck();
  await statuses.getByLabel("Unanswered", { exact: true }).uncheck();
  await statuses.getByLabel("Completed", { exact: true }).check();
  await statuses.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("No questions available", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start practice", exact: false }),
  ).toBeDisabled();
  const unavailable = page.getByText("No questions match or remain", {
    exact: false,
  });
  await expect(unavailable).toContainText("No questions match or remain");
  await expect(unavailable).toContainText("reset relevant study progress");

  await page
    .getByRole("button", { name: "Answer status: Completed", exact: true })
    .click();
  await statuses.getByLabel("Completed", { exact: true }).uncheck();
  await statuses.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Difficulty: Any difficulty" })
    .click();
  const difficulties = page.getByRole("group", {
    name: "Difficulty",
    exact: true,
  });
  await difficulties.getByLabel("Easy", { exact: true }).check();
  await difficulties.getByLabel("Hard", { exact: true }).check();
  await difficulties.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Difficulty: Easy, Hard" }),
  ).toBeVisible();
  await expect(page.getByText("Max 3", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("button", { name: "Answer status: Unanswered" }),
  ).toBeVisible();
});

async function seedAttempts(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("sat-study-local");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      const store = transaction.objectStore("state");
      const request = store.get("current");
      request.onsuccess = () => {
        const data = request.result;
        const filters = {
          section: "",
          domain: "",
          skill: "",
          domains: [],
          skills: [],
          statuses: [],
          difficulty: "",
          status: "",
          bookmark: "",
          active: "hide",
          search: "",
        };
        const entries = [
          ["s1", "demo-m01", false, "2026-01-01T00:00:00.000Z"],
          ["s2", "demo-m01", true, "2026-01-02T00:00:00.000Z"],
          ["s3", "demo-m02", true, "2026-01-03T00:00:00.000Z"],
          ["s4", "demo-r01", false, "2026-01-04T00:00:00.000Z"],
        ] as const;
        data.sessions = entries.map(
          ([id, questionId, , submittedAt], index) => ({
            id,
            questionIds: [questionId],
            index: 0,
            startedAt: submittedAt,
            finishedAt: submittedAt,
            filters: structuredClone(filters),
            drafts: {},
            elapsed: { [questionId]: index === 3 ? 68_000 : 1_000 },
            paused: false,
            timerVisible: true,
          }),
        );
        data.attempts = entries.map(
          ([sessionId, questionId, correct, submittedAt], index) => ({
            id: `a${index}`,
            sessionId,
            questionId,
            answer: correct ? "correct" : "incorrect",
            correct,
            durationMs: index === 3 ? 68_000 : 1_000,
            submittedAt,
          }),
        );
        store.put(data, "current");
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
}

async function seedSingleCorrectAttempt(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("sat-study-local");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("state", "readwrite");
      const store = transaction.objectStore("state");
      const request = store.get("current");
      request.onsuccess = () => {
        const data = request.result;
        const question = data.questions.find(
          (candidate: { testStatus: string }) =>
            candidate.testStatus !== "active",
        );
        const submittedAt = "2026-01-01T00:00:00.000Z";
        data.sessions = [
          {
            id: "perfect",
            questionIds: [question.id],
            index: 0,
            startedAt: submittedAt,
            finishedAt: submittedAt,
            filters: {
              section: "",
              domain: "",
              skill: "",
              domains: [],
              skills: [],
              statuses: [],
              difficulties: [],
              difficulty: "",
              status: "",
              bookmark: "",
              active: "hide",
              search: "",
            },
            drafts: {},
            elapsed: { [question.id]: 1_000 },
            paused: false,
          },
        ];
        data.attempts = [
          {
            id: "perfect-attempt",
            sessionId: "perfect",
            questionId: question.id,
            answer: "answer",
            correct: true,
            durationMs: 1_000,
            submittedAt,
          },
        ];
        store.put(data, "current");
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
}

test("gauge uses neutral empty and clean full-correct endpoints", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator(".gauge-empty")).toHaveCount(1);
  await expect(
    page.getByText("No attempts yet", { exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".gauge-empty")
      .evaluate((element) => getComputedStyle(element).strokeLinecap),
  ).toBe("butt");

  await seedSingleCorrectAttempt(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "All SAT practice: 100% accuracy across 1 attempt",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".gauge-correct")).toHaveAttribute(
    "stroke-dasharray",
    "100 0",
  );
  await expect(page.locator(".gauge-incorrect")).toHaveCount(0);
  expect(
    await page
      .locator(".gauge-correct")
      .evaluate((element) => getComputedStyle(element).strokeLinecap),
  ).toBe("butt");
});

test("Review scope, gauge, domains, evidence marks, and skills are interactive", async ({
  page,
}) => {
  await seedAttempts(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator(".domain-row")).toHaveCount(8);
  await expect(
    page.getByRole("img", {
      name: "All SAT practice: 50% accuracy across 4 attempts",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".gauge-correct")).toHaveAttribute(
    "stroke-dasharray",
    "50 50",
  );
  await expect(page.locator(".gauge-incorrect")).toHaveAttribute(
    "stroke-dasharray",
    "50 50",
  );
  const scope = page.getByRole("group", {
    name: "Performance scope",
    exact: true,
  });
  await scope.getByRole("button", { name: "Math", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Math: 67% accuracy across 3 attempts",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".performance-gauge")).toContainText(
    "2 correct · 1 incorrect",
  );
  await scope
    .getByRole("button", { name: "Reading & Writing", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Reading & Writing: 0% accuracy across 1 attempt",
      exact: true,
    }),
  ).toBeVisible();

  const algebra = page.locator(".domain-row").filter({
    has: page.getByText("Algebra", { exact: true }),
  });
  await algebra.getByText("Algebra", { exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Algebra: 67% accuracy across 3 attempts",
      exact: true,
    }),
  ).toBeVisible();
  await expect(algebra).toHaveAttribute("open", "");
  await expect(algebra).toContainText("Linear equations in one variable");
  await expect(algebra).toContainText("50% · 2 attempts");
  await expect(algebra).toContainText("Linear functions");
  await expect(algebra).toContainText("100% · 1 attempt");
  await expect(
    algebra.getByRole("img", {
      name: "2 correct and 1 incorrect across 3 attempts.",
      exact: true,
    }),
  ).toBeVisible();

  const advanced = page.locator(".domain-row").filter({
    has: page.getByText("Advanced Math", { exact: true }),
  });
  await expect(advanced).toContainText("No attempts");
  await advanced.getByText("Advanced Math", { exact: true }).click();
  await expect(advanced).toHaveAttribute("open", "");
  await expect(algebra).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("img", {
      name: "Advanced Math: not attempted, 0 attempts",
      exact: true,
    }),
  ).toBeVisible();
  await advanced.getByText("Advanced Math", { exact: true }).click();
  await expect(advanced).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("img", {
      name: "Reading & Writing: 0% accuracy across 1 attempt",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".gauge-incorrect")).toHaveCount(1);
  await expect(page.locator(".gauge-correct")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Practice mistakes", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 820, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Review presents recorded session and per-question timing", async ({
  page,
}) => {
  await seedAttempts(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const latest = page.locator(".session-row").first();
  await expect(latest).toContainText("1m 08s active time");
  await latest.click();
  await expect(
    page.getByText("1m 08s active study time", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Average 1m 08s / answered question", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".result-list summary").first()).toContainText(
    "1m 08s",
  );
});
