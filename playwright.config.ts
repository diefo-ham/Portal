import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { EXAMPLES_OFF_KEY } from "./src/core/bundled";
import { join } from "node:path";
export default defineConfig({
  outputDir: join(tmpdir(), "sat-study-playwright-results"),
  testDir: "./tests/browser",
  fullyParallel: false,
  // Shared CI runners are slower than a laptop, and a few specs send keys within
  // milliseconds of a render. Retried passes are reported as "flaky", not hidden.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://127.0.0.1:4318",
    // BROWSER=firefox or BROWSER=webkit (Safari's engine) runs the suite there.
    browserName:
      (process.env.BROWSER as "chromium" | "firefox" | "webkit") || "chromium",
    // The example questions that ship with the app are off, so a fresh browser
    // starts empty as the specs expect; examples.spec.ts turns them back on.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4318",
          localStorage: [{ name: EXAMPLES_OFF_KEY, value: "off" }],
        },
      ],
    },
    // Specs intercept network requests; offline.spec.ts opts back in.
    serviceWorkers: "block",
    // Locally the installed Edge is used; CI installs Playwright's Chromium.
    channel:
      process.env.CI ||
      (process.env.BROWSER && process.env.BROWSER !== "chromium")
        ? undefined
        : "msedge",
  },
  webServer: {
    command: "node scripts/serve.mjs --port 4318 --no-local-library",
    url: "http://127.0.0.1:4318",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
