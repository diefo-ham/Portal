import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load synthetic sample", exact: true })
    .click();
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

  await page
    .getByRole("button", { name: "Answer status: All questions" })
    .click();
  const statuses = page.getByRole("group", {
    name: "Answer status",
    exact: true,
  });
  await statuses.getByLabel("Mistakes", { exact: true }).check();
  await statuses.getByLabel("Unanswered", { exact: true }).check();
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
        data.sessions = entries.map(([id, questionId, , submittedAt]) => ({
          id,
          questionIds: [questionId],
          index: 0,
          startedAt: submittedAt,
          finishedAt: submittedAt,
          filters: structuredClone(filters),
          drafts: {},
          elapsed: {},
          paused: false,
          timerVisible: true,
        }));
        data.attempts = entries.map(
          ([sessionId, questionId, correct, submittedAt], index) => ({
            id: `a${index}`,
            sessionId,
            questionId,
            answer: correct ? "correct" : "incorrect",
            correct,
            durationMs: 1000,
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
  await expect(advanced).toContainText("Not attempted");
  await expect(advanced).toContainText("0 attempts");
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
