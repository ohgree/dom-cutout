import { defineConfig, devices } from "@playwright/test";

// Browser-level regression suite for the mask construction — see
// docs/webkit-masking.md for the failure modes it guards.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    deviceScaleFactor: 2,
  },
  projects: [
    // WebKit is the engine every guarded failure mode lives in; Chromium is
    // the control.
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm exec vite --config e2e/vite.config.ts --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
