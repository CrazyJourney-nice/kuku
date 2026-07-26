import { defineConfig } from "@playwright/test";

const port = 4173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./outputs/playwright",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // The seven user-provided PNGs are intentionally exercised serially so the
  // local Vinext server cannot produce visual fallbacks under I/O contention.
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "outputs/playwright-report" }]]
    : "list",
  use: {
    baseURL,
    locale: "zh-CN",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Shanghai",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "kiosk-narrow-390x693",
      use: {
        browserName: "chromium",
        hasTouch: true,
        viewport: { width: 390, height: 693 },
      },
    },
    {
      name: "kiosk-logical-540x960",
      use: {
        browserName: "chromium",
        hasTouch: true,
        viewport: { width: 540, height: 960 },
      },
    },
    {
      name: "kiosk-full-1080x1920",
      use: {
        browserName: "chromium",
        hasTouch: true,
        viewport: { width: 1080, height: 1920 },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
