import { test, expect } from "@playwright/test";
import { parseQuestions } from "../../src/importing/json";
import { seedStudyData } from "./seed";
import sample from "../fixtures/synthetic.json" with { type: "json" };

const withWork = {
  questions: parseQuestions(sample),
  attempts: [
    {
      id: "a1",
      questionId: "demo-m01",
      answer: "B",
      correct: true,
      submittedAt: "2026-01-01T00:00:00.000Z",
      durationMs: 1000,
    },
  ],
  annotations: { "demo-m01": { bookmarked: true, note: "" } },
};

async function openSettings(page: import("@playwright/test").Page) {
  await page.goto("/");
  await seedStudyData(page, withWork);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
}

test("removing questions keeps the app usable and shows how to add them again", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openSettings(page);
  await page.getByRole("button", { name: "Remove my questions" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your answers and bookmarks are kept");
  await dialog.getByRole("button", { name: "Remove questions" }).click();
  await expect(page.getByText("Questions removed.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove my questions" }),
  ).toBeDisabled();
  for (const name of ["Practice", "Review", "Browse", "Settings"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("main")).toBeVisible();
  }
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add your question PDFs" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("erasing everything returns the app to a clean first run", async ({
  page,
}) => {
  await openSettings(page);
  await page.evaluate(() => localStorage.setItem("sat-timer-default", "true"));
  await page
    .getByRole("button", { name: "Erase all data on this device" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Erase everything" })
    .click();
  await expect(
    page.getByRole("button", { name: "Add your question PDFs" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("sat-timer-default")),
  ).toBeNull();
  const stored = await page.evaluate(
    async () =>
      (await indexedDB.databases()).filter(
        (db) => db.name === "sat-study-local",
      ).length,
  );
  // The reloaded app recreates an empty database; it holds no questions.
  expect(stored).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("No questions yet.")).toBeVisible();
});
