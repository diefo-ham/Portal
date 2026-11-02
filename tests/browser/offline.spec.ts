import { expect, test } from "@playwright/test";

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
    page.getByRole("button", { name: "Load synthetic sample" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load synthetic sample" }).click();
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
