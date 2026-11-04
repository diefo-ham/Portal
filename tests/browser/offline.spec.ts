import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSample } from "./seed";

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

test("the manifest and icons are reachable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("SAT Study");
  for (const icon of manifest.icons)
    expect((await request.get("/" + icon.src)).ok()).toBe(true);
});

test("preparing PDF exports keeps working offline once the reader has been used", async ({
  page,
  context,
}) => {
  const fixtures: Record<string, string> = JSON.parse(
    readFileSync("tests/fixtures/synthetic-exports.json", "utf8"),
  );
  const dir = mkdtempSync(join(tmpdir(), "sat-study-offline-pdf-"));
  const paths = Object.keys(fixtures).map((name) => {
    const path = join(dir, name);
    writeFileSync(path, Buffer.from(fixtures[name], "base64"));
    return path;
  });
  const prepare = async (done: string) => {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Add PDFs" }).click();
    const dialog = page.getByRole("dialog", { name: "Add your question PDFs" });
    await dialog.getByLabel("PDF export files").setInputFiles(paths);
    await dialog.getByRole("button", { name: "Add questions" }).click();
    await expect(dialog.getByText(done)).toBeVisible({ timeout: 90_000 });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  };

  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await prepare("Added 8 questions.");
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
  // The same PDFs again give the same questions, which is now said plainly.
  await prepare("Nothing changed.");
});
