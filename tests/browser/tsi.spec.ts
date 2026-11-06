import { test, expect, type Page } from "@playwright/test";
import { parseQuestions } from "../../src/importing/json";
import { seedStudyData } from "./seed";
import sample from "../fixtures/synthetic.json" with { type: "json" };

// The TSI portal: reaching it, the Official / Original label and its filter, the
// Settings switch that hides sample items, and the three calculators. Every
// question here is invented; no College Board text is involved.

const tsi = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `tsi-${id}`,
  assessment: "TSI",
  source: "TSI practice bank (TSIA2)",
  sourceId: id,
  section: "tsi-math",
  domain: "Algebraic Reasoning",
  skill: "Linear equations",
  difficulty: "easy",
  origin: "original",
  calculator: "basic",
  stem: `Synthetic TSI question ${id}.`,
  choices: ["A", "B", "C", "D"].map((letter) => ({
    id: letter,
    text: `Choice ${letter}`,
  })),
  answer: { type: "choice", value: "B" },
  rationale: "Because B is right.",
  testStatus: "unknown",
  ...extra,
});

const bank = () =>
  parseQuestions({
    schemaVersion: 1,
    questions: [
      tsi("o1", { origin: "official" }),
      tsi("o2", { origin: "official", calculator: "sqrt" }),
      tsi("n1"),
      tsi("n2", { calculator: "graphing" }),
      tsi("e1", {
        section: "tsi-elar",
        domain: "Literary Text Analysis",
        skill: "Inferences",
        calculator: undefined,
        origin: "original",
      }),
    ],
  });

async function seed(page: Page) {
  await page.goto("/#/tsi");
  await seedStudyData(page, {
    questions: [...parseQuestions(sample), ...bank()],
  });
}

test("the switch reaches the TSI, and the TSI keeps its own questions", async ({
  page,
}) => {
  await seed(page);
  await expect(page).toHaveURL(/#\/tsi$/);
  await expect(page.getByRole("button", { name: /TSI Study/ })).toBeVisible();
  await expect(page.getByText("Max 5")).toBeVisible();
  const switcher = page.getByRole("group", { name: "Choose a test" });
  await switcher.getByRole("button", { name: "Switch to SAT" }).click();
  // The SAT has its own questions, not the TSI's five.
  await expect(page.getByRole("button", { name: /SAT Study/ })).toBeVisible();
  await expect(page.getByText("Max 5")).toHaveCount(0);
  await page.goto("/");
  // The last test used is remembered.
  await expect(page.getByRole("button", { name: /SAT Study/ })).toBeVisible();
  await page.goto("/#/tsi");
  await expect(page.getByRole("button", { name: /TSI Study/ })).toBeVisible();
});

test("the Source filter selects Official or Original, and Browse shows the label", async ({
  page,
}) => {
  await seed(page);
  await page.getByText("Refine selection").click();
  await page.getByRole("button", { name: /Official and original/ }).click();
  await page.getByRole("checkbox", { name: "Official" }).check();
  await expect(page.getByText("Max 2")).toBeVisible();
  await page.getByRole("checkbox", { name: "Official" }).uncheck();
  await page.getByRole("checkbox", { name: "Original" }).check();
  await expect(page.getByText("Max 3")).toBeVisible();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await expect(page.locator(".origin-badge.official")).toHaveCount(0);
  await expect(page.locator(".origin-badge.original").first()).toBeVisible();
});

test("the Settings switch hides the official items and brings them back", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Settings" }).click();
  const include = page.getByLabel("Include College Board sample items");
  await expect(include).toBeChecked();
  await expect(page.getByText(/^5 questions · 0 attempts/)).toBeVisible();
  await include.uncheck();
  await expect(page.getByText(/^3 questions · 0 attempts/)).toBeVisible();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByText("Max 3")).toBeVisible();
  // The Source filter has nothing to choose between, so it is not shown.
  await page.getByText("Refine selection").click();
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByLabel("Include College Board sample items"),
  ).not.toBeChecked();
  await page.getByLabel("Include College Board sample items").check();
  await expect(page.getByText(/^5 questions · 0 attempts/)).toBeVisible();
});

test("removing the official items keeps the originals", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Remove official items" }).click();
  await page
    .getByRole("button", { name: "Yes, remove 2 official items" })
    .click();
  await expect(page.getByText(/^3 questions · 0 attempts/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove official items" }),
  ).toHaveCount(0);
  // The SAT's questions are untouched.
  await page
    .getByRole("group", { name: "Choose a test" })
    .getByRole("button", { name: "Switch to SAT" })
    .click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText(/^12 questions · 0 attempts/)).toBeVisible();
});

test("each Math question opens the calculator its tag names", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Mathematics" }).first().click();
  await page.getByRole("button", { name: /Start practice/ }).click();
  const seen = new Set<string>();
  for (let step = 0; step < 4; step++) {
    const chip = (await page.locator(".calculator-chip").textContent()) ?? "";
    seen.add(chip);
    await page.getByRole("button", { name: "Calculator", exact: true }).click();
    const tier = chip.replace(" calculator", "");
    if (tier === "Graphing") {
      await expect(
        page.getByRole("heading", { name: "Calculator", exact: true }),
      ).toBeVisible();
    } else {
      const group = page.getByRole("group", { name: chip });
      await group.getByRole("button", { name: "7", exact: true }).click();
      await group.getByRole("button", { name: "Multiply" }).click();
      await group.getByRole("button", { name: "6", exact: true }).click();
      await group.getByRole("button", { name: "Equals" }).click();
      await expect(group.locator("output")).toHaveText("42");
      expect(
        await group.getByRole("button", { name: "Square root" }).count(),
      ).toBe(tier === "Square root" ? 1 : 0);
    }
    await page.getByRole("button", { name: "Close calculator" }).click();
    const next = page.getByRole("button", { name: /^Next|Skip/ });
    if (await next.count()) {
      await next.first().click();
      // Wait for the next question, so its chip is not read from the one before.
      await expect(page.getByText(`Question ${step + 2} of 4`)).toBeVisible();
    }
  }
  expect(seen).toEqual(
    new Set([
      "Basic calculator",
      "Square root calculator",
      "Graphing calculator",
    ]),
  );
});

test("an ELAR question offers no calculator and no calculator chip", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "ELAR" }).first().click();
  await page.getByRole("button", { name: /Start practice/ }).click();
  await expect(
    page.getByText("Synthetic TSI question e1.").or(page.locator("h1")),
  ).toBeVisible();
  await expect(page.locator(".calculator-chip")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Calculator", exact: true }),
  ).toHaveCount(0);
});
