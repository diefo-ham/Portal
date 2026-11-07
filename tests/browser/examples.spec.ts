import { expect, test, type Page } from "@playwright/test";
import { parseQuestions } from "../../src/importing/json";
import sample from "../fixtures/synthetic.json" with { type: "json" };

// The other specs start without the bundled examples; this one is the real first run.
test.use({ storageState: { cookies: [], origins: [] } });

/** Adds the synthetic fixtures as the person's own SAT questions, keeping the examples. */
async function addOwnQuestions(page: Page) {
  const own = parseQuestions(sample);
  await page.evaluate(async (questions) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sat-study-local", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const store = (mode: IDBTransactionMode) =>
      db.transaction("state", mode).objectStore("state");
    const current = await new Promise<{ questions: unknown[] }>((resolve) => {
      const request = store("readonly").get("current");
      request.onsuccess = () => resolve(request.result);
    });
    current.questions.push(...questions);
    await new Promise<void>((resolve) => {
      const request = store("readwrite").put(current, "current");
      request.onsuccess = () => resolve();
    });
    db.close();
  }, own);
  await page.reload();
}

const stored = (page: Page) =>
  page.getByText(/questions · \d+ attempts · \d+ bookmarks/);

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
}

test("a first run has the examples for every test, and the Tests screens are locked", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/sat");
  await openSettings(page);
  await expect(stored(page)).toContainText("120 questions");
  await expect(
    page.getByText(/Only the example questions are here so far/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove my questions" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Tests open when you add your own questions.",
    }),
  ).toBeVisible();

  // The same for the PAA (in Spanish) and the TSI.
  await page.goto("/#/paa");
  await page
    .getByRole("button", { name: "Modo de prueba", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Las pruebas se abren cuando agregas tus propias preguntas.",
    }),
  ).toBeVisible();
  await page.goto("/#/tsi");
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Tests open when you add your own questions.",
    }),
  ).toBeVisible();

  // Studying with the examples works: Browse lists them.
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText("Your question library is empty.")).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("adding your own questions opens the tests; removing them leaves the examples", async ({
  page,
}) => {
  await page.goto("/#/sat");
  await openSettings(page);
  await expect(stored(page)).toContainText("120 questions");
  await addOwnQuestions(page);

  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A test, at your pace." }),
  ).toBeVisible();

  await openSettings(page);
  await expect(
    page.getByText(/12 questions are stored in this browser/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove my questions" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove questions" })
    .click();
  await expect(page.getByText("Questions removed.")).toBeVisible();
  // The examples stay, and the Tests screen locks again.
  await expect(stored(page)).toContainText("120 questions");
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Tests open when you add your own questions.",
    }),
  ).toBeVisible();
});
