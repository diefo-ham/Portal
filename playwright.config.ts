import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
  outputDir: join(tmpdir(), "sat-study-playwright-results"),
  testDir: "./tests/browser",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4318",
    browserName: "chromium",
    // Locally the installed Edge is used; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "msedge",
  },
  webServer: {
    command: "node scripts/serve.mjs --port 4318 --no-local-library --no-local-config",
    url: "http://127.0.0.1:4318",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
