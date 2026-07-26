import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_E2E_PORT;

if (!port) {
  throw new Error(
    "PLAYWRIGHT_E2E_PORT is not set. Run E2E tests through an npm test:e2e script.",
  );
}

const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "webkit-safari",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
