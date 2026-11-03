import { test, expect, type Page } from "@playwright/test";
import type { StudyData } from "../../src/core/model";
import { loadSample } from "./seed";
async function state(page: Page): Promise<StudyData> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sat-study-local");
      r.onsuccess = () => resolve(r.result);
    });
    try {
      return await new Promise<StudyData>((resolve) => {
        const r = db.transaction("state").objectStore("state").get("current");
        r.onsuccess = () => resolve(r.result);
      });
    } finally {
      db.close();
    }
  });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto("/");
  await loadSample(page);
});

test("compact domain and skill combinations persist in a deterministically resumed set", async ({
  page,
}) => {
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("button", { name: /^Domain:/ }).click();
  const domains = page.getByRole("group", { name: "Domain", exact: true });
  await domains.getByLabel("Algebra", { exact: true }).check();
  await domains.getByLabel("Advanced Math", { exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Domain: 2 selected" }),
  ).toBeFocused();
  await page.getByText("Refine selection", { exact: true }).click();
  await page.getByRole("button", { name: /^Skill:/ }).click();
  const skills = page.getByRole("group", { name: "Skill", exact: true });
  await skills
    .getByLabel("Linear equations in one variable", { exact: true })
    .check();
  await skills.getByLabel("Quadratic equations", { exact: true }).check();
  await skills.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Skill: 2 selected" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Answer status: Unanswered" }).click();
  await expect(
    page.getByRole("group", { name: "Answer status", exact: true }),
  ).toContainText("MistakesUnansweredCompleted");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("combobox", { name: "Practice-test status" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Protect practice-test questions", { exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: "private-data/inspection/stage3-home.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Domain: 2 selected" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  const saved = (await state(page)).sessions.at(-1)!;
  expect(saved.questionIds).toEqual(["demo-m01", "demo-m03"]);
  expect(saved.filters.domains).toHaveLength(2);
  expect(saved.filters.skills).toHaveLength(2);
  await expect(page.getByRole("article")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Open question overview" }),
  ).toHaveText(/Question 2/);
  await page.reload();
  await page.getByRole("button", { name: "Resume practice" }).click();
  const resumed = (await state(page)).sessions.at(-1)!;
  expect(resumed.questionIds).toEqual(saved.questionIds);
  expect(resumed.filters).toEqual(saved.filters);
  expect(resumed.index).toBe(1);
});

test("results retain three outcomes and offer entire, mistaken and unanswered session retries", async ({
  page,
}) => {
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("5");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByLabel("Your numeric answer").fill("999");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Not quite. Let’s work through it."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice tools" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "1 correct, 1 incorrect, 3 unanswered" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  const original = (await state(page)).sessions[0];
  await page.screenshot({
    path: "private-data/inspection/stage3-results.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Practice entire session again", exact: true })
    .click();
  const entire = (await state(page)).sessions.at(-1)!;
  expect([...entire.questionIds].sort()).toEqual(
    [...original.questionIds].sort(),
  );
  expect(entire.questionIds).not.toEqual(original.questionIds);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await expect(
    page.getByText("Something to revisit", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .locator(".session-row")
    .filter({ hasText: "1 correct · 1 incorrect · 3 unanswered" })
    .click();
  await page
    .getByRole("button", { name: "Practice mistakes (1)", exact: true })
    .click();
  expect((await state(page)).sessions.at(-1)!.questionIds).toEqual([
    "demo-m02",
  ]);
  await page.getByLabel("Your numeric answer").fill("28");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
  await page.getByRole("button", { name: "Review session" }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByText("No mistakes waiting to revisit.")).toBeVisible();
  await page.screenshot({
    path: "private-data/inspection/stage3-review.png",
    fullPage: true,
  });
  await page
    .locator(".session-row")
    .filter({ hasText: "1 correct · 1 incorrect · 3 unanswered" })
    .click();
  await expect(
    page.getByRole("img", { name: "1 correct, 1 incorrect, 3 unanswered" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Show", exact: true })
    .selectOption("unanswered");
  await expect(page.locator(".result-list details")).toHaveCount(3);
  await page.locator(".result-list details").first().locator("summary").click();
  await expect(
    page
      .locator(".result-list details")
      .first()
      .getByText("No answer submitted.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Correct answer:", { exact: false })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Practice unanswered (3)", exact: true })
    .click();
  expect((await state(page)).sessions.at(-1)!.questionIds.sort()).toEqual([
    "demo-m03",
    "demo-m04",
    "demo-m05",
  ]);
  await page.getByRole("button", { name: "← Exit", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Practice unanswered", exact: true })
    .click();
  expect((await state(page)).sessions.at(-1)!.questionIds.sort()).toEqual([
    "demo-m03",
    "demo-m04",
    "demo-m05",
  ]);
  expect((await state(page)).sessions[0]).toEqual(original);
});
