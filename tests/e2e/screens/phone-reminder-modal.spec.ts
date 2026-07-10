import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  createE2EAdminClient,
  findE2EStudentUserId,
  resolveE2EStudentConfig,
} from "../_setup/e2e-student-fixture";

// Phone-number reminder modal (X-05 companion). Runs against the shared authed
// student (auth-state/student.json). auth.setup permanently dismisses the modal
// for that student as a baseline; this spec clears the flag per test to exercise
// the modal, then restores it so later specs are not overlaid.
//
// Skips automatically when the split-phone reminder columns are absent
// (migrations 20260709153000 + 20260709154000 + 20260709165000 not applied on
// this environment), so it never false-fails before the schema catches up.

const koMessages = JSON.parse(
  readFileSync(path.join(process.cwd(), "messages", "ko.json"), "utf8"),
) as {
  app: {
    phoneReminder: {
      title: string;
      dismiss: string;
    };
  };
};

const REMINDER_TITLE = koMessages.app.phoneReminder.title;
const DISMISS_LABEL = koMessages.app.phoneReminder.dismiss;
const LEGACY_SESSION_SUPPRESS_KEY = "talkpik.phoneReminderModalDismissed";

const config = resolveE2EStudentConfig();
const admin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.serviceRoleKey,
  { auth: { persistSession: false } },
);

let studentId = "";
let columnReady = false;

test.beforeAll(async () => {
  studentId = await findE2EStudentUserId(
    createE2EAdminClient(config),
    config.email,
  );
  const probe = await admin
    .from("profiles")
    .select("phone_country_code, phone_number_prompt_dismissed_at")
    .limit(1);
  columnReady = !probe.error;
});

test.beforeEach(async () => {
  test.skip(
    !columnReady,
    "profiles.phone_number_prompt_dismissed_at is not applied on this environment; apply migrations 20260709153000 + 20260709154000 + 20260709165000.",
  );
  const { error } = await admin
    .from("profiles")
    .update({
      phone_country_code: null,
      phone_number: null,
      phone_number_prompt_dismissed_at: null,
    })
    .eq("id", studentId);
  if (error) throw error;
});

test.afterEach(async () => {
  if (!columnReady) return;
  // Restore the suppressed baseline so subsequent authed specs are not overlaid.
  await admin
    .from("profiles")
    .update({ phone_number_prompt_dismissed_at: new Date().toISOString() })
    .eq("id", studentId);
});

test("opens the reminder modal on dashboard entry", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(REMINDER_TITLE)).toBeVisible();
});

test("opens on a direct-URL landing to a non-dashboard page", async ({
  page,
}) => {
  await page.goto("/library", { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(REMINDER_TITLE)).toBeVisible();
});

test("ignores session suppression left by another account", async ({ page }) => {
  await page.goto("/library", { waitUntil: "networkidle" });
  await page.evaluate((legacyKey) => {
    window.sessionStorage.setItem(legacyKey, "1");
    window.sessionStorage.setItem(`${legacyKey}:another-user`, "1");
  }, LEGACY_SESSION_SUPPRESS_KEY);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(REMINDER_TITLE)).toBeVisible();
});

test("does not interrupt the profile editor route", async ({ page }) => {
  await page.goto("/profile", { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("permanently dismisses via the modal action", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: DISMISS_LABEL }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const { data } = await admin
    .from("profiles")
    .select("phone_number_prompt_dismissed_at")
    .eq("id", studentId)
    .maybeSingle();
  expect(data?.phone_number_prompt_dismissed_at).not.toBeNull();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
