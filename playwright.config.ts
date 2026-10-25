import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4317",
    browserName: "chromium",
    channel: "msedge",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:4317",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
