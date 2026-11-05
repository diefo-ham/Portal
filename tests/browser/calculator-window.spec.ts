import { test, expect } from "@playwright/test";
import { loadSample } from "./seed";

test("numbers typed into the graph window survive the graph moving underneath", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page);
  await page.getByRole("group", { name: "Section" }).getByText("Math").click();
  await page.getByRole("textbox", { name: "Session size" }).fill("2");
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.getByRole("button", { name: "Calculator", exact: true }).click();
  await page.getByText("Graph window", { exact: true }).click();
  const field = (name: string) => page.getByLabel(name, { exact: true });
  const plane = page.locator("svg[data-x-max]").first();

  // Untouched fields follow the graph.
  const before = await field("yMax").inputValue();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(field("yMax")).not.toHaveValue(before);

  // A number being typed is kept when the graph changes (as when the panel
  // is resized), and the rest of the window can still be entered.
  await field("xMin").fill("-20");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(field("xMin")).toHaveValue("-20");
  await field("yMin").fill("-20");
  await field("xMax").fill("20");
  await field("yMax").fill("20");
  await page.getByRole("button", { name: "Apply window", exact: true }).click();
  await expect(plane).toHaveAttribute("data-y-min", "-20");
  await expect(plane).toHaveAttribute("data-y-max", "20");
  // The equal-axes rule widens x around its centre, so x is symmetric.
  const [xMin, xMax] = await plane.evaluate((svg) => [
    Number((svg as SVGElement).dataset.xMin),
    Number((svg as SVGElement).dataset.xMax),
  ]);
  expect(xMin).toBeCloseTo(-xMax, 6);
  expect(xMax).toBeGreaterThanOrEqual(20);

  // Invalid bounds are refused without changing the graph.
  await field("xMin").fill("30");
  await field("xMax").fill("-30");
  await page.getByRole("button", { name: "Apply window", exact: true }).click();
  await expect(page.getByText(/each minimum below its maximum/)).toBeVisible();
  // The message makes the panel taller. Let that resize land before checking,
  // so a sub-pixel change in the graph's size cannot rescale the typed window.
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await expect(plane).toHaveAttribute("data-y-max", "20");
  await expect(field("yMax")).toHaveValue("20");
});
