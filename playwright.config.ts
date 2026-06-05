import { defineConfig, devices } from "@playwright/test";

// Implementation Coverage Audit (Plan rev4, SBU-B+C) + future regression tests.
// Lifecycle: durable.
//
// Tests use storageState files at tests/e2e/auth-state/{role}.json. Those
// files are gitignored.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false, // serialize for coverage matrix correctness
  workers: 1,
  retries: 1, // R-8 Windows mitigation: 1 retry on screenshot/nav failure
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/failure-log.json" }],
  ],
  projects: [
    // All projects use Chromium — WebKit binaries not installed in this
    // environment. Audit screenshots are responsive-layout-only, engine
    // parity is not required.
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 720 } },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
