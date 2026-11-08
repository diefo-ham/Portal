import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseQuestions } from "../../src/importing/json";
import { loadSample, seedStudyData } from "./seed";

// Unlike the other specs, this one lets the service worker run.
test.use({ serviceWorkers: "allow" });

test("the app reopens, practices and opens the calculator with no network", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The worker claims the page once installed and has precached the build.
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.keys()).some((key) => key.startsWith("sat-study-")),
      ),
    )
    .toBe(true);

  await context.setOffline(true);
  const failures: string[] = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add your question PDFs" }),
  ).toBeVisible();
  await loadSample(page);
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Expression 1", exact: true }),
  ).toBeFocused();
  // Only the optional local-library and calculator-config probes may fail.
  expect(
    failures.filter(
      (url) => !/\/(local-library\/|calculator-config\.json)/.test(url),
    ),
  ).toEqual([]);
});

test("the TSI portal opens, practices and offers its keypad calculator with no network", async ({
  page,
  context,
}) => {
  await page.goto("/#/tsi");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.keys()).some((key) => key.startsWith("sat-study-")),
      ),
    )
    .toBe(true);

  await context.setOffline(true);
  const failures: string[] = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.reload();
  await seedStudyData(page, {
    questions: parseQuestions({
      schemaVersion: 1,
      questions: [
        {
          id: "tsi-offline1",
          assessment: "TSI",
          source: "TSI practice bank (TSIA2)",
          sourceId: "offline1",
          section: "tsi-math",
          domain: "Algebraic Reasoning",
          skill: "Linear equations",
          difficulty: "easy",
          origin: "original",
          calculator: "sqrt",
          stem: "Synthetic offline question.",
          choices: ["A", "B", "C", "D"].map((id) => ({
            id,
            text: `Choice ${id}`,
          })),
          answer: { type: "choice", value: "A" },
          testStatus: "unknown",
        },
      ],
    }),
  });
  await expect(page.getByRole("button", { name: /TSI Study/ })).toBeVisible();
  await page.getByRole("button", { name: /Start practice/ }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  const keypad = page.getByRole("group", { name: "Square root calculator" });
  await keypad.getByRole("button", { name: "9" }).click();
  await keypad.getByRole("button", { name: "Square root" }).click();
  await expect(keypad.locator("output")).toHaveText("3");
  expect(
    failures.filter(
      (url) => !/\/(local-library\/|calculator-config\.json)/.test(url),
    ),
  ).toEqual([]);
});

test("the manifest and icons are reachable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("SAT Study");
  for (const icon of manifest.icons)
    expect((await request.get("/" + icon.src)).ok()).toBe(true);
});

test("reading a PDF keeps working offline once the reader has been used", async ({
  page,
  context,
}) => {
  // An export without the portal's access code: the reader still opens and
  // sorts it, and the import refuses it, which is what proves it ran.
  const fixtures: Record<string, string> = JSON.parse(
    readFileSync("tests/fixtures/synthetic-exports.json", "utf8"),
  );
  const dir = mkdtempSync(join(tmpdir(), "sat-study-offline-pdf-"));
  const path = join(dir, "any name.pdf");
  writeFileSync(path, Buffer.from(fixtures["math_active.pdf"], "base64"));
  const refused = async () => {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Add PDFs" }).click();
    const dialog = page.getByRole("dialog", { name: "Add your question PDFs" });
    await dialog.getByLabel("PDF export files").setInputFiles(path);
    // The file has been looked at once the button opens.
    await expect(
      dialog.getByRole("button", { name: "Add questions" }),
    ).toBeEnabled({ timeout: 90_000 });
    await dialog.getByRole("button", { name: "Add questions" }).click();
    await expect(
      dialog.getByText(/no page carries the access code/),
    ).toBeVisible({ timeout: 90_000 });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  };

  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await refused();
  // The reader is cached the first time it is loaded.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        for (const key of await caches.keys())
          if (key.endsWith("-runtime"))
            return (await (await caches.open(key)).keys()).length;
        return 0;
      }),
    )
    .toBeGreaterThanOrEqual(2);

  await context.setOffline(true);
  await page.reload();
  await refused();
});
