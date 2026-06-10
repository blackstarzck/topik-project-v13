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
    throw new Error("Missing Supabase service credentials for D-M2 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createPendingSubmission() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

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
  if (!problem.data?.id) throw new Error("No published q51 problem found");

  const answerText = [
    "D-M2 pending analysis regression answer.",
    "This submitted text stays read-only behind the modal while AI analysis runs.",
    "The route should render a dimmed background and a focused progress dialog.",
  ].join("\n");
  const id = randomUUID();
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
  createdSubmissionIds.push(id);
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
  "D-M2 e2e requires Supabase service credentials for an isolated pending row",
);

test("D-M2 analysis loading modal renders over a read-only submitted answer", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const submissionId = await createPendingSubmission();

  await page.goto(`/writing/feedback/short/${submissionId}`, {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  await expect(page.getByTestId("analysis-loading-background")).toBeVisible();
  const modal = page.getByTestId("analysis-loading-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator(".ant-modal-mask")).toBeVisible();
  await expect(page.getByText("예상 소요 시간 8~15초")).toBeVisible();
  await expect(page.locator(".analysis-loading__steps")).toBeVisible();
  await expect(page.locator(".ant-steps-item-active")).toHaveCount(1);

  await page.getByTestId("analysis-loading-cancel").click();
  await expect(
    page.locator(".ant-modal-confirm-title", {
      hasText: "분석을 중단할까요?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "계속 기다리기" }).click();
  await expect(modal).toBeVisible();

  expect(errors).toEqual([]);
});
