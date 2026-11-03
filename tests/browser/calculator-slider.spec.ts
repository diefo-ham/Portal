import { test, expect, type Page } from "@playwright/test";
import { enterExpression } from "./math-input";
import { loadSample } from "./seed";

async function open(page: Page) {
  await page.goto("/");
  await loadSample(page);
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
}
const named = (page: Page, name: string) =>
  page.getByRole("spinbutton", { name, exact: true });

test("a slider's range and step can be set, and the graph follows the value", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "a=3");
  const slider = page.getByRole("slider", { name: "a slider", exact: true });
  await expect(slider).toHaveValue("3");
  await expect(slider).toHaveAttribute("min", "-10");
  await expect(slider).toHaveAttribute("max", "10");

  await named(page, "a slider maximum").fill("50");
  await named(page, "a slider minimum").fill("0");
  await expect(slider).toHaveAttribute("max", "50");
  await expect(slider).toHaveAttribute("min", "0");
  // A bad range is flagged and not applied.
  await named(page, "a slider minimum").fill("80");
  await expect(named(page, "a slider minimum")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(slider).toHaveAttribute("min", "0");
  await named(page, "a slider minimum").fill("0");

  await page.getByRole("button", { name: "a slider settings" }).click();
  await named(page, "a slider step").fill("5");
  await slider.fill("40");
  await expect(slider).toHaveValue("40");

  // The settings are saved with the session: close and reopen the calculator.
  await page.getByRole("button", { name: "Close calculator" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await expect(slider).toHaveAttribute("max", "50");
  await expect(slider).toHaveAttribute("step", "5");
  await expect(slider).toHaveValue("40");
});

test("playing a slider moves its value within the range, and pausing stops it", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "a=0");
  await enterExpression(page, 2, "y=ax");
  const slider = page.getByRole("slider", { name: "a slider", exact: true });
  await named(page, "a slider minimum").fill("0");
  await named(page, "a slider maximum").fill("10");
  await page.getByRole("button", { name: "a slider settings" }).click();
  await page.getByLabel("a slider speed").selectOption("4");

  await page.getByRole("button", { name: "Play a slider" }).click();
  await expect(
    page.getByRole("button", { name: "Pause a slider" }),
  ).toHaveAttribute("aria-pressed", "true");
  const seen = new Set<string>();
  await expect
    .poll(async () => {
      seen.add(await slider.inputValue());
      return seen.size;
    })
    .toBeGreaterThan(4);
  for (const value of seen) {
    expect(Number(value)).toBeGreaterThanOrEqual(0);
    expect(Number(value)).toBeLessThanOrEqual(10);
  }

  await page.getByRole("button", { name: "Pause a slider" }).click();
  // The last tick can still land just after the click; wait for the value to rest.
  await page.waitForTimeout(300);
  const held = await slider.inputValue();
  await page.waitForTimeout(500);
  await expect(slider).toHaveValue(held);

  // "Once" runs to the end and stops by itself.
  await page.getByLabel("a slider animation").selectOption("once");
  await page.getByRole("button", { name: "Play a slider" }).click();
  await expect(slider).toHaveValue("10", { timeout: 10_000 });
  await expect(
    page.getByRole("button", { name: "Play a slider" }),
  ).toHaveAttribute("aria-pressed", "false");

  // Dragging the slider takes over from the animation.
  await page.getByLabel("a slider animation").selectOption("bounce");
  await page.getByRole("button", { name: "Play a slider" }).click();
  await slider.focus();
  await slider.dispatchEvent("pointerdown");
  await expect(
    page.getByRole("button", { name: "Play a slider" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("switching to Repeat while the value is falling stays inside the range", async ({
  page,
}) => {
  await open(page);
  await enterExpression(page, 1, "a=5");
  const slider = page.getByRole("slider", { name: "a slider", exact: true });
  await named(page, "a slider minimum").fill("0");
  await named(page, "a slider maximum").fill("10");
  await page.getByRole("button", { name: "a slider settings" }).click();
  await page.getByLabel("a slider speed").selectOption("4");
  await page.getByRole("button", { name: "Play a slider" }).click();

  // Wait until it has turned around and is falling, then change the mode.
  let previous = Number(await slider.inputValue());
  let falling = 0;
  for (let i = 0; i < 150 && falling < 3; i++) {
    await page.waitForTimeout(60);
    const now = Number(await slider.inputValue());
    falling = now < previous ? falling + 1 : now > previous ? 0 : falling;
    previous = now;
  }
  expect(falling).toBeGreaterThanOrEqual(3);
  await page.getByLabel("a slider animation").selectOption("loop");

  const seen: number[] = [];
  for (let i = 0; i < 40; i++) {
    seen.push(Number(await slider.inputValue()));
    await page.waitForTimeout(100);
  }
  for (const value of seen) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(10);
  }
  // Repeat counts upward from here and jumps back to the minimum at the top,
  // rather than carrying on downwards.
  const jumps = seen.filter((value, i) => i > 0 && seen[i - 1] - value > 5);
  expect(jumps.length).toBeGreaterThan(0);
});
