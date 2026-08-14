import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const koMessages = JSON.parse(
  readFileSync(path.join(process.cwd(), "messages", "ko.json"), "utf8"),
) as {
  feedback: {
    actions: {
      pdfQuotaExceededTitle: string;
      pdfQuotaExceededDescription: string;
    };
  };
};

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
const PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

const createdSubmissionIds: string[] = [];
const createdResetIds: string[] = [];
const createdExportIds: string[] = [];
const createdStoragePaths: string[] = [];
const createdQuotaTargets: Array<{ userId: string; problemId: string }> = [];

test.use({ storageState: { cookies: [], origins: [] } });

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for PDF quota e2e");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function loginStudent(page: Page) {
  expect(
    PASSWORD,
    "E2E_STUDENT_PASSWORD or SUPABASE_TEST_PASSWORD must be set for PDF quota e2e",
  ).not.toBe("");

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(
    /\/(dashboard|auth\/consent|onboarding\/learning-goal)/,
    { timeout: 15_000 },
  );
  await page.waitForLoadState("networkidle");

  if (new URL(page.url()).pathname === "/auth/consent") {
    await page.locator('input[name="accept"]').check({ force: true });
    await page.locator('form button[type="submit"]').click();
  }

  await page
    .waitForURL(/\/onboarding\/learning-goal/, { timeout: 5_000 })
    .catch(() => undefined);
  if (new URL(page.url()).pathname === "/onboarding/learning-goal") {
    await page.locator('form button[type="submit"]').click();
  }

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function quotaSchemaAvailable() {
  const { error } = await serviceClient()
    .from("pdf_export_quota_resets")
    .select("id")
    .limit(1);
  if (!error) return true;
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /pdf_export_quota_resets|schema cache/i.test(error.message)
  ) {
    return false;
  }
  throw error;
}

async function createCompletedFeedbackSubmission() {
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

  const submissionId = randomUUID();
  const answerText =
    "금요일 오후 세 시에 회사 근처 카페에서 만나면 좋겠습니다.";
  const inserted = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: 51,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (inserted.error) throw inserted.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 82,
    score_max: 100,
    overall_summary: "요청한 시간과 장소가 분명하게 드러난 답안입니다.",
    ai_model: "e2e-fixture",
    ai_model_version: "pdf-quota",
    raw_ai_result: {},
  });
  if (feedback.error) throw feedback.error;

  const dimension = await sb.from("feedback_dimension_scores").insert({
    submission_id: submissionId,
    user_id: user.id,
    dimension: "content",
    score: 82,
    score_max: 100,
    summary: "필수 정보를 빠짐없이 담았습니다.",
    weakness_level: 1,
  });
  if (dimension.error) throw dimension.error;

  createdSubmissionIds.push(submissionId);
  createdQuotaTargets.push({
    userId: user.id,
    problemId: problem.data.id as string,
  });
  return {
    submissionId,
    userId: user.id,
    problemId: problem.data.id as string,
  };
}

async function seedUserResetTarget(input: {
  userId: string;
  problemId: string;
}) {
  const sb = serviceClient();
  const reset = await sb
    .from("pdf_export_quota_resets")
    .insert({
      reset_scope: "user",
      problem_id: input.problemId,
      reason: "e2e pdf quota reset",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (reset.error) throw reset.error;

  const target = await sb.from("pdf_export_quota_reset_targets").insert({
    reset_id: reset.data.id,
    user_id: input.userId,
  });
  if (target.error) throw target.error;
  createdResetIds.push(reset.data.id);
}

async function clearPdfQuotaFixtureState(input: {
  userId: string;
  problemId: string;
}) {
  const sb = serviceClient();
  const resets = await sb
    .from("pdf_export_quota_resets")
    .select("id")
    .eq("problem_id", input.problemId)
    .eq("reason", "e2e pdf quota reset");
  if (resets.error) throw resets.error;

  const resetIds =
    resets.data?.map((reset) => reset.id).filter((id): id is string => !!id) ??
    [];

  if (resetIds.length > 0) {
    const targetDelete = await sb
      .from("pdf_export_quota_reset_targets")
      .delete()
      .in("reset_id", resetIds);
    if (targetDelete.error) throw targetDelete.error;

    const resetDelete = await sb
      .from("pdf_export_quota_resets")
      .delete()
      .in("id", resetIds);
    if (resetDelete.error) throw resetDelete.error;
  }

  const usageDelete = await sb
    .from("pdf_export_quota_usages")
    .delete()
    .eq("user_id", input.userId)
    .eq("problem_id", input.problemId);
  if (usageDelete.error) throw usageDelete.error;
}

async function stubStorageDownloadAndPrintEndpoint(page: Page) {
  let printEndpointCalls = 0;

  await page.route("**/storage/v1/object/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.4\n%DOTORE TOPIK e2e\n%%EOF",
    });
  });

  await page.route("**/api/export/pdf/print", async (route) => {
    printEndpointCalls += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "print fallback should not run" }),
    });
  });

  return {
    getPrintEndpointCalls: () => printEndpointCalls,
  };
}

async function stubPdfExportQuotaSequence(page: Page) {
  let pdfCalls = 0;

  await page.route("**/api/export/pdf", async (route) => {
    pdfCalls += 1;
    if (pdfCalls <= 3) {
      const exportId = randomUUID();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          exportId,
          storagePath: `exports/e2e/${exportId}.pdf`,
          filename: "learning-export.pdf",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: koMessages.feedback.actions.pdfQuotaExceededTitle,
        code: "pdf_export_quota_exceeded",
        limit: 3,
        used: 3,
        remaining: 0,
        resetAt: "2026-08-01T00:00:00+09:00",
        periodUnit: "month",
      }),
    });
  });

  return {
    getPdfCalls: () => pdfCalls,
  };
}

async function closeNotifications(page: Page) {
  await page
    .locator(".ant-notification-notice-close")
    .evaluateAll((elements) => {
      elements.forEach((element) => {
        if (element instanceof HTMLElement) element.click();
      });
    })
    .catch(() => undefined);
  await page
    .locator(".ant-notification-notice")
    .evaluateAll((elements) => {
      elements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.pointerEvents = "none";
        }
      });
    })
    .catch(() => undefined);
}

test.afterAll(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  const hasQuotaSchema = await quotaSchemaAvailable().catch(() => false);

  for (const storagePath of createdStoragePaths) {
    await sb.storage.from("generated-exports").remove([storagePath]);
  }

  if (hasQuotaSchema) {
    for (const target of createdQuotaTargets) {
      await sb
        .from("pdf_export_quota_usages")
        .delete()
        .eq("user_id", target.userId)
        .eq("problem_id", target.problemId);
    }
  }

  for (const exportId of createdExportIds) {
    await sb.from("export_files").delete().eq("id", exportId);
  }

  if (hasQuotaSchema) {
    for (const resetId of createdResetIds) {
      await sb
        .from("pdf_export_quota_reset_targets")
        .delete()
        .eq("reset_id", resetId);
      await sb.from("pdf_export_quota_resets").delete().eq("id", resetId);
    }
  }

  for (const id of createdSubmissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
});

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "PDF quota e2e requires Supabase service credentials for isolated fixtures",
);

test("feedback PDF quota warning UI does not invoke print fallback", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    (
      window as unknown as { __pdfQuotaPrintCalls: number }
    ).__pdfQuotaPrintCalls = 0;
    window.print = () => {
      (
        window as unknown as { __pdfQuotaPrintCalls: number }
      ).__pdfQuotaPrintCalls += 1;
    };
  });

  const submission = await createCompletedFeedbackSubmission();
  const pdfNetwork = await stubStorageDownloadAndPrintEndpoint(page);
  const pdfApi = await stubPdfExportQuotaSequence(page);

  await loginStudent(page);
  await page.goto(`/writing/feedback/short/${submission.submissionId}`, {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  const pdfButton = page.getByTestId("feedback-action-pdf");
  await expect(pdfButton).toBeVisible();
  for (let i = 0; i < 3; i += 1) {
    await closeNotifications(page);
    await expect(pdfButton).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/export/pdf") &&
        response.request().method() === "POST",
    );
    await pdfButton.click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await closeNotifications(page);
  }

  const blockedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/export/pdf") &&
      response.request().method() === "POST",
  );
  await pdfButton.click();
  const response = await blockedResponse;
  expect(response.status()).toBe(429);
  await expect(
    page.getByText(koMessages.feedback.actions.pdfQuotaExceededTitle),
  ).toBeVisible();
  await expect(
    page.getByText(koMessages.feedback.actions.pdfQuotaExceededDescription),
  ).toBeVisible();

  expect(pdfApi.getPdfCalls()).toBe(4);
  expect(pdfNetwork.getPrintEndpointCalls()).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __pdfQuotaPrintCalls: number })
            .__pdfQuotaPrintCalls,
      ),
    )
    .toBe(0);
});

test("feedback PDF export quota warning does not invoke print fallback", async ({
  page,
}) => {
  test.setTimeout(90_000);
  test.skip(
    !(await quotaSchemaAvailable()),
    "PDF quota e2e requires the 20260707120000_pdf_export_quota migration.",
  );

  await page.addInitScript(() => {
    (
      window as unknown as { __pdfQuotaPrintCalls: number }
    ).__pdfQuotaPrintCalls = 0;
    window.print = () => {
      (
        window as unknown as { __pdfQuotaPrintCalls: number }
      ).__pdfQuotaPrintCalls += 1;
    };
  });
  const submission = await createCompletedFeedbackSubmission();
  await clearPdfQuotaFixtureState(submission);
  await seedUserResetTarget(submission);
  const pdfNetwork = await stubStorageDownloadAndPrintEndpoint(page);

  await loginStudent(page);
  await page.goto(`/writing/feedback/short/${submission.submissionId}`, {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  const pdfButton = page.getByTestId("feedback-action-pdf");
  await expect(pdfButton).toBeVisible();
  for (let i = 0; i < 3; i += 1) {
    await closeNotifications(page);
    await expect(pdfButton).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/export/pdf") &&
        response.request().method() === "POST",
    );
    await pdfButton.click();
    await expect(pdfButton).toBeDisabled();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      exportId?: string;
      storagePath?: string;
    };
    if (body.exportId) createdExportIds.push(body.exportId);
    if (body.storagePath) createdStoragePaths.push(body.storagePath);
    await closeNotifications(page);
  }

  await expect(pdfButton).toBeEnabled();
  const blockedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/export/pdf") &&
      response.request().method() === "POST",
  );
  await pdfButton.click();
  const response = await blockedResponse;
  expect(response.status()).toBe(429);
  await expect(
    page.getByText(koMessages.feedback.actions.pdfQuotaExceededTitle),
  ).toBeVisible();
  await expect(
    page.getByText(koMessages.feedback.actions.pdfQuotaExceededDescription),
  ).toBeVisible();

  expect(pdfNetwork.getPrintEndpointCalls()).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __pdfQuotaPrintCalls: number })
            .__pdfQuotaPrintCalls,
      ),
    )
    .toBe(0);

  await closeNotifications(page);
  await seedUserResetTarget(submission);

  await expect(pdfButton).toBeEnabled();
  const resetResponse = page.waitForResponse(
    (nextResponse) =>
      nextResponse.url().endsWith("/api/export/pdf") &&
      nextResponse.request().method() === "POST",
  );
  await pdfButton.click();
  const resetExportResponse = await resetResponse;
  expect(resetExportResponse.status()).toBe(200);
  const body = (await resetExportResponse.json()) as {
    exportId?: string;
    storagePath?: string;
  };
  if (body.exportId) createdExportIds.push(body.exportId);
  if (body.storagePath) createdStoragePaths.push(body.storagePath);
});
