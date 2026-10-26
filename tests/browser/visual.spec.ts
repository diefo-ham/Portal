import { test, expect, type Page } from "@playwright/test";
import sample from "../../src/data/synthetic.json" with { type: "json" };

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `private-data/inspection/stage4-${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}

test("Auto follows live system changes; explicit appearance persists through reload and progress reset", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.getByLabel("Keep original PDF colors", { exact: true }).check();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("dark");
  await expect(
    page.getByLabel("Keep original PDF colors", { exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Reset study progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-pdf-appearance",
    "original",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Theme", { exact: true }).selectOption("auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: contrast, focus, laptop layouts, dialogs and all study surfaces`, async ({
    page,
    context,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("sat-theme", value);
      Math.random = () => 0.999999;
    }, theme);
    const remote: string[] = [];
    await context.route("**/*", async (route) => {
      if (
        !route.request().url().startsWith("http://127.0.0.1:4318") &&
        !route.request().url().startsWith("data:")
      ) {
        remote.push(route.request().url());
        await route.abort();
      } else await route.continue();
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Load synthetic sample", exact: true })
      .click();
    for (const width of [1024, 1280, 1366, 1920, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
      expect(await overflow(page), `Home at ${width}`).toBe(false);
      await page.getByRole("button", { name: /^Domain:/ }).click();
      expect(await overflow(page), `Dropdown at ${width}`).toBe(false);
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    const ratios = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const lightness = (key: string) => {
        const hex = css.getPropertyValue(key).trim().slice(1);
        const c = [0, 2, 4].map((index) => {
          const v = parseInt(hex.slice(index, index + 2), 16) / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      const pairs = [
        ["--ink", "--bg"],
        ["--muted", "--bg"],
        ["--ink", "--paper"],
        ["--muted", "--paper"],
        ["--on-accent", "--accent"],
        ["--correct", "--correct-surface"],
        ["--incorrect", "--incorrect-surface"],
        ["--warning", "--warning-surface"],
      ];
      return pairs.map(([fg, bg]) => {
        const a = lightness(fg),
          b = lightness(bg);
        return {
          fg,
          bg,
          contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    });
    for (const pair of ratios)
      expect(pair.contrast, JSON.stringify(pair)).toBeGreaterThanOrEqual(4.5);
    const domain = page.getByRole("button", { name: /^Domain:/ });
    await domain.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(
      await domain.evaluate(
        (element) =>
          element.matches(":focus-visible") &&
          getComputedStyle(element).outlineStyle !== "none",
      ),
    ).toBe(true);
    await shot(page, `${theme}-home-focus`);
    await page
      .getByRole("combobox", { name: "Section", exact: true })
      .selectOption("math");
    await page.getByRole("button", { name: "Start practice" }).click();
    await expect(page.getByRole("article")).toBeFocused();
    await shot(page, `${theme}-practice`);
    await page.getByRole("button", { name: "Calculator", exact: true }).click();
    await page.getByLabel("First number").fill("6");
    await page.getByLabel("Second number").fill("7");
    await page.getByLabel("Operation").selectOption("×");
    await expect(page.locator(".calculator-result")).toHaveText("42");
    for (const width of [1024, 1280, 1366, 1920, 820, 390]) {
      await page.setViewportSize({ width, height: 768 });
      expect(await overflow(page), `Calculator at ${width}`).toBe(false);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await shot(page, `${theme}-calculator`);
    await page.getByRole("button", { name: "Practice tools" }).click();
    await shot(page, `${theme}-tools`);
    await page
      .getByRole("button", { name: "Question details", exact: true })
      .click();
    await shot(page, `${theme}-details`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open question overview" }).click();
    await shot(page, `${theme}-overview`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Close calculator" }).click();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(
      page.getByText("Not quite. Let’s work through it."),
    ).toBeVisible();
    await shot(page, `${theme}-feedback`);
    await page.getByRole("button", { name: "Practice tools" }).click();
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await shot(page, `${theme}-results`);
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await shot(page, `${theme}-review`);
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await shot(page, `${theme}-browse`);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await shot(page, `${theme}-settings`);
    await page
      .getByRole("button", { name: "Reset study progress", exact: true })
      .click();
    await shot(page, `${theme}-reset`);
    await page.keyboard.press("Escape");
    expect(remote).toEqual([]);
  });
}

test("long reading and dense PDF tables stay readable in both themes; reduced motion and original appearance work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const paragraph =
    "The field notebook records observations made along a riverbank over several seasons. Researchers compared the measurements with earlier surveys, considering both the changing water level and the different methods used to identify each plant. These details matter because a trend can reflect the sampling method as well as a change in the landscape.";
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "white";
    c.fillRect(0, 0, 1200, 900);
    c.fillStyle = "black";
    c.font = "26px Georgia";
    c.fillText("A laboratory recorded the following measurements:", 45, 60);
    for (let row = 0; row < 10; row++) {
      c.fillText(
        `${row + 1}          ${row * 3 + 8}          ${row * 4 + 12}          ${row * 2 + 6}`,
        70,
        150 + row * 60,
      );
      c.beginPath();
      c.moveTo(45, 170 + row * 60);
      c.lineTo(1120, 170 + row * 60);
      c.stroke();
    }
    c.fillText("Which model describes the relationship in the table?", 45, 820);
    return canvas.toDataURL("image/png");
  });
  const long = {
    ...sample.questions[6],
    id: "visual-reading",
    passage: Array(6).fill(paragraph).join("\n\n"),
    stem: "Which conclusion is best supported by the observations?",
  };
  const dense = {
    ...sample.questions[0],
    id: "visual-table",
    document: {
      question: [
        {
          src: png,
          alt: "Original synthetic measurement table",
          width: 1200,
          height: 900,
        },
      ],
      rationale: [
        {
          src: png,
          alt: "Synthetic table explanation",
          width: 1200,
          height: 900,
        },
      ],
      textIsApproximate: true,
      provenance: [
        { filename: "synthetic.pdf", sha256: "b".repeat(64), pages: [1] },
      ],
    },
  };
  await page.getByLabel("Import question JSON").setInputFiles({
    name: "visual-fixtures.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ schemaVersion: 1, questions: [long, dense] }),
    ),
  });
  await expect(page.getByRole("status")).toContainText("2 questions imported");
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await page.locator(".question-row").first().click();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(".passage")).toBeVisible();
    expect(await overflow(page)).toBe(false);
    expect(
      await page
        .locator(".passage")
        .evaluate((el) => el.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(860);
    await shot(page, `${theme}-long-reading`);
    await page.getByRole("button", { name: "← Exit", exact: true }).click();
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await page.locator(".question-row").nth(1).click();
    await expect(
      page.getByLabel("Original PDF question").locator("img"),
    ).toBeVisible();
    await shot(page, `${theme}-table`);
    expect(await overflow(page)).toBe(false);
    await page.getByRole("radio").nth(1).check();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct. Nicely done.")).toBeVisible();
    await shot(page, `${theme}-table-feedback`);
    await page.getByRole("button", { name: "← Exit", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
  }
  await page.getByLabel("Keep original PDF colors", { exact: true }).check();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await page.locator(".question-row").nth(1).click();
  await expect(
    page.getByLabel("Original PDF question").locator("img"),
  ).toHaveCSS("filter", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.locator(".feedback")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".progress-track > div")).toHaveCSS(
    "transition-duration",
    "0s",
  );
});
