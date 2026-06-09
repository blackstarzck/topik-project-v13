import path from "node:path";
import { test as setup, expect } from "@playwright/test";

// Logs in the learner test account and persists the browser storageState so the
// viewport projects can render authed (workspace) pages without 307 → /login.
// The previous tests/e2e/auth-state/student.json expired 2026-06-08; this
// regenerates it. Origin is the config baseURL (127.0.0.1:3000) so the Supabase
// auth cookie is bound to the same host the capture/render-shot uses.
//
// Credentials: email from E2E_STUDENT_EMAIL (default student@audit.local),
// password from SUPABASE_TEST_PASSWORD (.env.local, loaded by playwright.config).
// NEVER printed or committed.

const STUDENT_STATE = path.join("tests", "e2e", "auth-state", "student.json");
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD ?? "";

setup("authenticate student", async ({ page }) => {
  expect(
    PASSWORD,
    "SUPABASE_TEST_PASSWORD must be set in .env.local for auth setup",
  ).not.toBe("");

  await page.goto("/login");

  // Locale-agnostic selectors (the app default-renders Korean): antd Form.Item
  // inputs carry these autocomplete attrs; the submit Button renders type=submit.
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // LoginForm calls router.push("/dashboard") on success.
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // Persist cookies + localStorage for reuse by the authed viewport projects.
  await page.context().storageState({ path: STUDENT_STATE });
});
