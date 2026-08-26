import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import {
  SUPABASE_DEV_PROJECT_REF,
  assertLiveDevProjectTarget,
  resolvePublicPlaywrightSafety,
  resolveStandardPlaywrightSafety,
} from "./scripts/lib/supabase-target-safety.mjs";

// Implementation Coverage Audit (Plan rev4, SBU-B+C) + future regression tests.
// 2026-06-09 wireframe page-review (D4): adds a `setup` project that logs in and
// writes a fresh storageState, and wires the viewport projects to depend on it.
// Lifecycle: durable.
//
// Tests use storageState files at tests/e2e/auth-state/{role}.json. Those
// files are gitignored (they hold auth tokens / test-user PII).

// Load .env.local into process.env WITHOUT printing any value (dotenv is not a
// dependency). Used so the setup project can read SUPABASE_TEST_PASSWORD. Dev only.
function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local absent (CI) — tests that need it will fail with a clear message.
  }
}
loadEnvLocal();
const publicReadOnly = process.env.PLAYWRIGHT_PUBLIC_READ_ONLY === "1";
const authReadOnly = process.env.PLAYWRIGHT_AUTH_READ_ONLY === "1";

if (publicReadOnly && authReadOnly) {
  throw new Error(
    "PLAYWRIGHT_AUTH_READ_ONLY=1 and PLAYWRIGHT_PUBLIC_READ_ONLY=1 are mutually exclusive.",
  );
}

const playwrightSafety =
  publicReadOnly || authReadOnly
    ? resolvePublicPlaywrightSafety(process.env)
    : resolveStandardPlaywrightSafety(process.env);

if (authReadOnly) {
  assertLiveDevProjectTarget({
    projectRef: SUPABASE_DEV_PROJECT_REF,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

const STUDENT_STATE = "tests/e2e/auth-state/student.json";
if (authReadOnly && !existsSync(path.resolve(process.cwd(), STUDENT_STATE))) {
  throw new Error(
    `PLAYWRIGHT_AUTH_READ_ONLY=1 requires the saved auth state at ${STUDENT_STATE}.`,
  );
}

const standardViewportProjects = publicReadOnly
  ? [
      {
        name: "public-mobile-360",
        testMatch:
          /screens\/(?:landing-locales|screens-public|system-reporting)\.spec\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 360, height: 720 },
        },
      },
      {
        name: "public-desktop-1280",
        testMatch:
          /screens\/(?:landing-locales|screens-public|system-reporting)\.spec\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 1280, height: 800 },
        },
      },
    ]
  : [
      // Setup: log in once, persist storageState that the viewport projects reuse.
      {
        name: "setup",
        testMatch: /_setup\/.*\.setup\.ts$/,
      },
      // All viewport projects use Chromium — WebKit binaries not installed in this
      // environment. Audit screenshots are responsive-layout-only, engine parity
      // is not required. They run the screen + flow specs against the authed state.
      {
        name: "mobile-360",
        testMatch: /(screens|flows)\/.*\.spec\.ts$/,
        dependencies: ["setup"],
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 360, height: 720 },
          storageState: STUDENT_STATE,
        },
      },
      {
        name: "tablet-768",
        testMatch: /(screens|flows)\/.*\.spec\.ts$/,
        dependencies: ["setup"],
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 768, height: 1024 },
          storageState: STUDENT_STATE,
        },
      },
      {
        name: "desktop-1280",
        testMatch: /(screens|flows)\/.*\.spec\.ts$/,
        dependencies: ["setup"],
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 1280, height: 800 },
          storageState: STUDENT_STATE,
        },
      },
    ];

const viewportProjects = authReadOnly
  ? [
      {
        name: "auth-read-only-mobile-360",
        testMatch: /screens\/phase5d-alternate-theme\.spec\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 360, height: 720 },
          storageState: STUDENT_STATE,
        },
      },
      {
        name: "auth-read-only-desktop-1280",
        testMatch: /screens\/phase5d-alternate-theme\.spec\.ts$/,
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 1280, height: 800 },
          storageState: STUDENT_STATE,
        },
      },
    ]
  : standardViewportProjects;

export default defineConfig({
  testDir: "tests/e2e",
  // phase-6-smoke.spec.mjs is a standalone node script (no test() calls, calls
  // process.exit) — exclude it from the Playwright runner so it can't abort the run.
  // The live remote suites are topik-ai-owned provider/canonical acceptance
  // and never run in default v13. Phase smoke remains a standalone Node script.
  testIgnore: playwrightSafety.testIgnore,
  fullyParallel: false, // serialize for coverage matrix correctness
  workers: 1,
  retries: 1, // R-8 Windows mitigation: 1 retry on screenshot/nav failure
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: playwrightSafety.baseUrl,
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
  projects: viewportProjects,
});
