import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // CI without .env.local skips through the explicit guard below.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const NON_PROD_LABELS = new Set([
  "dev",
  "development",
  "local",
  "preview",
  "qa",
  "staging",
  "test",
  "testing",
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const createdSubmissionIds: string[] = [];
const createdStudyEventIds: string[] = [];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for KPI e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function kstDayKey(input: Date | string): string {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(new Date(input));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateAtKstHour(dayKey: string, hour: number): Date {
  return new Date(Date.parse(`${dayKey}T00:00:00.000+09:00`) + hour * 3600000);
}

function shiftKstDay(dayKey: string, offset: number): string {
  return kstDayKey(
    new Date(Date.parse(`${dayKey}T00:00:00.000+09:00`) + offset * DAY_MS),
  );
}

function computeStreakDays(occurredAtList: string[]): number {
  const today = kstDayKey(new Date());
  const yesterday = shiftKstDay(today, -1);
  const days = Array.from(new Set(occurredAtList.map(kstDayKey)))
    .filter((day) => day <= today)
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  if (days.length === 0) return 0;
  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = days[0];
  for (const day of days) {
    if (day !== cursor) break;
    streak += 1;
    cursor = shiftKstDay(cursor, -1);
  }
  return streak;
}

async function findStudentUserId() {
  if (!EMAIL) throw new Error("E2E_STUDENT_EMAIL must be set");
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);
  return user.id;
}

async function createKpiFixture() {
  const sb = serviceClient();
  const userId = await findStudentUserId();
  const problem = await sb
    .from("problems")
    .select("id, question_no")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .eq("visibility", "public")
    .eq("lifecycle_status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id) throw new Error("No active public writing problem");

  const problemId = problem.data.id;
  const today = kstDayKey(new Date());
  const yesterday = shiftKstDay(today, -1);
  const marker = `kpi-source-${randomUUID()}`;
  const questionNo = problem.data.question_no ?? 53;
  const submissions = [
    {
      id: randomUUID(),
      submittedAt: dateAtKstHour(today, 10).toISOString(),
      text: `${marker} today submission`,
    },
    {
      id: randomUUID(),
      submittedAt: dateAtKstHour(yesterday, 10).toISOString(),
      text: `${marker} yesterday submission`,
    },
  ];

  const insertSubmissions = await sb.from("writing_submissions").insert(
    submissions.map((submission) => ({
      id: submission.id,
      user_id: userId,
      problem_id: problemId,
      question_no: questionNo,
      answer_text: submission.text,
      char_count: submission.text.length,
      feedback_status: "complete",
      submitted_at: submission.submittedAt,
    })),
  );
  if (insertSubmissions.error) throw insertSubmissions.error;
  createdSubmissionIds.push(...submissions.map((submission) => submission.id));

  const studyEvents = [
    {
      id: randomUUID(),
      occurredAt: dateAtKstHour(today, 11).toISOString(),
      eventType: "submission_submitted",
      submissionId: submissions[0].id,
    },
    {
      id: randomUUID(),
      occurredAt: dateAtKstHour(yesterday, 11).toISOString(),
      eventType: "feedback_viewed",
      submissionId: submissions[1].id,
    },
  ];
  const insertEvents = await sb.from("study_events").insert(
    studyEvents.map((event) => ({
      id: event.id,
      user_id: userId,
      event_type: event.eventType,
      occurred_at: event.occurredAt,
      problem_id: problemId,
      submission_id: event.submissionId,
      payload: { source: marker },
    })),
  );
  if (insertEvents.error) throw insertEvents.error;
  createdStudyEventIds.push(...studyEvents.map((event) => event.id));

  return userId;
}

async function countSubmissions(userId: string) {
  const sb = serviceClient();
  const today = kstDayKey(new Date());
  const todayStart = dateAtKstHour(today, 0).toISOString();
  const todayEnd = dateAtKstHour(shiftKstDay(today, 1), 0).toISOString();
  const todayRes = await sb
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("submitted_at", todayStart)
    .lt("submitted_at", todayEnd);
  if (todayRes.error) throw todayRes.error;
  const totalRes = await sb
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (totalRes.error) throw totalRes.error;
  return {
    today: todayRes.count ?? 0,
    total: totalRes.count ?? 0,
  };
}

async function countStreak(userId: string) {
  const sb = serviceClient();
  const events = await sb
    .from("study_events")
    .select("occurred_at")
    .eq("user_id", userId);
  if (events.error) throw events.error;
  return computeStreakDays(
    (events.data ?? []).map((event) => event.occurred_at as string),
  );
}

async function cleanupKpiFixtures() {
  if (createdStudyEventIds.length === 0 && createdSubmissionIds.length === 0) {
    return;
  }
  if (!NON_PROD_LABELS.has(ENV_LABEL)) return;
  const sb = serviceClient();
  if (createdStudyEventIds.length > 0) {
    await sb.from("study_events").delete().in("id", createdStudyEventIds);
  }
  if (createdSubmissionIds.length > 0) {
    await sb.from("writing_submissions").delete().in("id", createdSubmissionIds);
  }
  createdStudyEventIds.length = 0;
  createdSubmissionIds.length = 0;
}

test.afterEach(cleanupKpiFixtures);
test.afterAll(cleanupKpiFixtures);

test.skip(
  !EMAIL ||
    !SUPABASE_URL ||
    !SERVICE_KEY ||
    !NON_PROD_LABELS.has(ENV_LABEL),
  "KPI source e2e requires non-production Supabase service credentials",
);

test("dashboard and growth KPIs use writing submissions and study-event streaks", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const userId = await createKpiFixture();
  const submissionCounts = await countSubmissions(userId);
  const streakDays = await countStreak(userId);

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("dashboard-kpi-today-submissions")).toContainText(
    String(submissionCounts.today),
  );
  await expect(page.getByTestId("dashboard-kpi-streak")).toContainText(
    String(streakDays),
  );

  await page.goto("/growth", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("growth-kpi-attempts")).toContainText(
    String(submissionCounts.total),
  );

  expect(errors).toEqual([]);
});
