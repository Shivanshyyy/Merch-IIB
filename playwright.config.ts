import { defineConfig } from "@playwright/test";

// Runs against a production build on one server: `npm run e2e` (see scripts/with-server.mjs). No webServer block on
// purpose, so a second server can never be started by accident.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    // Reduced motion keeps the run fast and deterministic; the animations have their own browser walkthroughs.
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
