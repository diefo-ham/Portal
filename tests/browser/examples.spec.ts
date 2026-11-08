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
  // With only the examples there is nothing to protect and no examples switch.
  await expect(
    page.getByRole("checkbox", {
      name: "Protect unused practice-test questions",
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: "Include example questions" }),
  ).toHaveCount(0);
  await addOwnQuestions(page);

  // Once there are questions of your own, the examples are hidden by default,
  // the protection setting appears, and a switch brings the examples back.
  await openSettings(page);
  await expect(stored(page)).toContainText("12 questions");
  await expect(
    page.getByRole("checkbox", {
      name: "Protect unused practice-test questions",
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Include example questions" })
    .check();
  await expect(stored(page)).toContainText("132 questions");
  await page
    .getByRole("checkbox", { name: "Include example questions" })
    .uncheck();
  await expect(stored(page)).toContainText("12 questions");

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

test("the SAT and the PAA share the example-questions setting, and the TSI does not", async ({
  page,
}) => {
  await page.goto("/#/sat");
  await openSettings(page);
  await expect(stored(page)).toContainText("120 questions");
  await addOwnQuestions(page);

  // Switch the examples on in the SAT.
  await openSettings(page);
  const sat = page.getByRole("checkbox", { name: "Include example questions" });
  await expect(sat).not.toBeChecked();
  await sat.check();

  // The PAA follows it (and offers it, because the SAT has questions of its own).
  await page.goto("/#/paa");
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Incluir preguntas de ejemplo" }),
  ).toBeChecked();

  // Switch it off from the PAA: the SAT is off too.
  await page
    .getByRole("checkbox", { name: "Incluir preguntas de ejemplo" })
    .uncheck();
  await page.goto("/#/sat");
  await openSettings(page);
  await expect(
    page.getByRole("checkbox", { name: "Include example questions" }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(() => localStorage.getItem("sat-show-examples")),
  ).toBe("false");

  // The TSI has no questions of its own here, so it offers nothing, and its own
  // setting was never touched.
  await page.goto("/#/tsi");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Include example questions" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("sat-show-examples-tsi")),
  ).toBeNull();
});
