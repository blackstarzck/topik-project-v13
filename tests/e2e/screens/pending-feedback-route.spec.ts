import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
    // CI without .env.local will skip through the explicit env guard below.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const createdSubmissionIds: string[] = [];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// Paginate the auth user list so the student is found even past the first 1000
// users (mirrors tests/e2e/_setup/e2e-student-fixture.ts findUserByEmail).
async function findStudentUser(sb: ReturnType<typeof serviceClient>) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  throw new Error(
    "E2E student user not found for E2E_STUDENT_EMAIL — run the setup project first and check .env.local",
  );
}

async function createPendingSubmission() {
  const sb = serviceClient();
  const user = await findStudentUser(sb);

  const problem = await sb
    .from("problems")
    .select("id")
    .eq("domain", "writing")
    .eq("question_no", 51)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id)
    throw new Error(
      "No published q51 writing problem found in this Supabase project (NEXT_PUBLIC_SUPABASE_URL). Seed at least one published q51 problem before running this e2e.",
    );

  const answerText = [
    "Pending feedback route regression answer.",
    "The legacy feedback loading modal must not render for this submission.",
  ].join("\n");
  const id = randomUUID();
  // Register for cleanup before the insert so a partial failure still gets torn
  // down by afterAll instead of leaking a row.
  createdSubmissionIds.push(id);
  const inserted = await sb.from("writing_submissions").insert({
    id,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: 51,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "analyzing",
  });
  if (inserted.error) throw inserted.error;
  return id;
}

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  await sb.from("writing_submissions").delete().in("id", createdSubmissionIds);
});

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "pending feedback route e2e requires Supabase service credentials",
);

test("pending feedback route redirects to library instead of rendering the legacy modal", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const submissionId = await createPendingSubmission();

  const response = await page.goto(`/writing/feedback/short/${submissionId}`, {
    waitUntil: "networkidle",
  });
  expect(
    response?.status(),
    `pending feedback route returned ${response?.status()} — a 404 means the fixture row is not visible to the logged-in e2e student (stale tests/e2e/auth-state/student.json or E2E_STUDENT_EMAIL mismatch)`,
  ).toBeLessThan(400);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/library(?:\?|$)/);
  await expect(page.getByTestId("analysis-loading-modal")).toHaveCount(0);
  await expect(page.getByTestId("analysis-loading-background")).toHaveCount(0);

  expect(errors).toEqual([]);
});
