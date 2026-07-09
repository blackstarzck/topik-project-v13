import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createE2EAdminClient,
  ensureE2EStudentUser,
  resolveE2EStudentConfig,
} from "./e2e-student-fixture";

// Logs in the learner test account and persists the browser storageState so the
// viewport projects can render authed (workspace) pages without 307 → /login.
// The previous tests/e2e/auth-state/student.json expired 2026-06-08; this
// regenerates it. Origin is the config baseURL (127.0.0.1:3000) so the Supabase
// auth cookie is bound to the same host the capture/render-shot uses.
//
// Credentials are loaded from .env.local by playwright.config. The setup project
// creates or refreshes the e2e student with the server-only Supabase admin key
// before logging in, so manual pre-seeding is not required. NEVER print or
// commit these values.

const STUDENT_STATE = path.join("tests", "e2e", "auth-state", "student.json");

setup("authenticate student", async ({ page }) => {
  const config = resolveE2EStudentConfig();
  const admin = createE2EAdminClient(config);
  const { userId } = await ensureE2EStudentUser(admin, config);

  // Baseline: permanently dismiss the phone-number reminder modal for the shared
  // authed student so it does not overlay every other authed spec. The dedicated
  // phone-reminder-modal spec clears this to exercise the modal. Tolerant of the
  // column being absent (migration 20260709154000 not yet applied) — when it is
  // absent the modal is already suppressed by the WorkspaceShell prop guard.
  try {
    const rawAdmin = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false },
    });
    const dismissed = await rawAdmin
      .from("profiles")
      .update({ phone_number_prompt_dismissed_at: new Date().toISOString() })
      .eq("id", userId);
    if (dismissed.error) {
      throw dismissed.error;
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "";
    if (!message.includes("phone_number_prompt_dismissed_at")) {
      throw error;
    }
    // Ignore: column may not exist on this environment yet.
  }

  await page.goto("/login");

  // Locale-agnostic selectors (the app default-renders Korean): antd Form.Item
  // inputs carry these autocomplete attrs; the submit Button renders type=submit.
  const emailInput = page.locator('input[autocomplete="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await emailInput.fill(config.email);
    await passwordInput.fill(config.password);
    if (
      (await emailInput.inputValue()) === config.email &&
      (await passwordInput.inputValue()) === config.password
    ) {
      break;
    }
    await page.waitForTimeout(150);
  }

  await expect(emailInput).toHaveValue(config.email);
  await expect(passwordInput).toHaveValue(config.password);
  await page.locator('button[type="submit"]').click();

  // LoginForm calls router.push("/dashboard") on success, then the workspace
  // guard may send accounts with missing required consent to /auth/consent,
  // and the dashboard page itself bounces to /onboarding/learning-goal when the
  // account has no learning goal yet.
  await page.waitForURL(
    /\/(dashboard|auth\/consent|onboarding\/learning-goal)/,
    {
      timeout: 15_000,
    },
  );
  await page.waitForLoadState("networkidle");
  await page
    .waitForURL(/\/auth\/consent/, { timeout: 5_000 })
    .catch(() => undefined);
  if (new URL(page.url()).pathname === "/auth/consent") {
    await page.locator('input[name="accept"]').check({ force: true });
    await page.locator('form button[type="submit"]').click();
  }

  // Onboarding gate: a freshly-seeded (or DB-wiped) account has no learning
  // goal, so /dashboard redirects here. The LearningGoalForm ships valid
  // defaults (TOPIK II, target grade 4), so submitting persists a goal and
  // returns to /dashboard — restoring an authed state usable by the viewport
  // projects. Mirrors the consent handler above.
  await page
    .waitForURL(/\/onboarding\/learning-goal/, { timeout: 5_000 })
    .catch(() => undefined);
  if (new URL(page.url()).pathname === "/onboarding/learning-goal") {
    await page.locator('form button[type="submit"]').click();
  }

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // Persist cookies + localStorage for reuse by the authed viewport projects.
  await page.context().storageState({ path: STUDENT_STATE });
});
