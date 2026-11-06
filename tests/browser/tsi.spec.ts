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

test("there is no Source filter, and a session shows no Official or Original tag", async ({
  page,
}) => {
  await seed(page);
  await page.getByText("Refine selection").click();
  await expect(page.getByText("Source", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mathematics" }).first().click();
  await page.getByRole("button", { name: /Start practice/ }).click();
  await expect(page.locator(".calculator-chip")).toBeVisible();
  await expect(page.locator(".origin-badge")).toHaveCount(0);
});

test("the Settings switch hides the original questions and brings them back", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Settings" }).click();
  const include = page.getByLabel("Include original questions");
  await expect(include).toBeChecked();
  // No switch for the College Board sample items, and no button to remove them.
  await expect(
    page.getByText("Include College Board sample items"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Remove official items/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/^5 questions · 0 attempts/)).toBeVisible();
  await include.uncheck();
  await expect(page.getByText(/^2 questions · 0 attempts/)).toBeVisible();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByText("Max 2")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Include original questions")).not.toBeChecked();
  await page.getByLabel("Include original questions").check();
  await expect(page.getByText(/^5 questions · 0 attempts/)).toBeVisible();
});

test("hiding the original questions keeps a session, without those questions", async ({
  page,
}) => {
  await seed(page);
  // A session over the whole TSI bank.
  await page.getByRole("button", { name: /Start practice/ }).click();
  await page.getByRole("button", { name: "Exit" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Include original questions").uncheck();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  // The session is still there to continue, now over the two official questions.
  await page
    .getByRole("button", { name: /Continue|Resume/ })
    .first()
    .click();
  await expect(page.getByText(/Question \d of 2/)).toBeVisible();
  await expect(page.locator(".calculator-chip, h1").first()).toBeVisible();
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
