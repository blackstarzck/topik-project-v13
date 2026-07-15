import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LIVE = process.env.E2E_CANONICAL_SUBMISSION_LIVE === "1";
const SAFE_ENV_LABELS = new Set([
  "dev",
  "development",
  "local",
  "preview",
  "qa",
  "staging",
  "test",
  "testing",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CanonicalRow = {
  canonical_import_id: number | string;
  payload_hash: string;
  problem_id: string;
  question_id: string;
};

type ProviderCanaryConfig = {
  anonKey: string;
  managementToken: string;
  projectRef: string;
  reportPath: string;
  screenshotPath: string;
  serviceRoleKey: string;
  studentEmail: string;
  studentPassword: string;
  supabaseUrl: string;
};

type CreatedState = {
  draftId: string | null;
  intentId: string | null;
  problemId: string | null;
  userId: string | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for provider live E2E.`);
  return value;
}

function resolveConfig(): ProviderCanaryConfig {
  if (!LIVE) throw new Error("E2E_CANONICAL_SUBMISSION_LIVE=1 is required.");
  if (process.env.E2E_ALLOW_DEV_DB_MUTATION !== "1") {
    throw new Error("E2E_ALLOW_DEV_DB_MUTATION=1 is required.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Provider live E2E refuses NODE_ENV=production.");
  }
  const label = required("SUPABASE_ENV_LABEL").toLowerCase();
  if (!SAFE_ENV_LABELS.has(label)) {
    throw new Error(`SUPABASE_ENV_LABEL is not non-production: ${label}`);
  }

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const projectRef = required("E2E_EXPECTED_SUPABASE_PROJECT_REF");
  const urlProjectRef = new URL(supabaseUrl).hostname.replace(
    /\.supabase\.co$/,
    "",
  );
  if (urlProjectRef !== projectRef) {
    throw new Error("Provider live E2E project-ref guard failed.");
  }

  return {
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    managementToken: required("SUPABASE_ACCESS_TOKEN"),
    projectRef,
    reportPath: required("PROVIDER_CANARY_REPORT_PATH"),
    screenshotPath: required("PROVIDER_CANARY_SCREENSHOT_PATH"),
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      required("SUPABASE_SECRET_KEY"),
    studentEmail: required("E2E_STUDENT_EMAIL"),
    studentPassword:
      process.env.E2E_STUDENT_PASSWORD?.trim() ||
      required("SUPABASE_TEST_PASSWORD"),
    supabaseUrl,
  };
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function managementSql(
  config: ProviderCanaryConfig,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${config.projectRef}/database/query`,
    {
      body: JSON.stringify({ query: sql }),
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Supabase Management SQL failed (${response.status}): ${await response.text()}`,
    );
  }
  return (await response.json()) as Array<Record<string, unknown>>;
}

function sqlUuid(value: string | null): string {
  if (!value) return "null::uuid";
  if (!UUID_PATTERN.test(value)) {
    throw new Error("Provider canary cleanup received a non-UUID identifier.");
  }
  return `'${value}'::uuid`;
}

async function cleanup(
  config: ProviderCanaryConfig,
  state: CreatedState,
): Promise<void> {
  if (!state.intentId && !state.draftId) return;
  await managementSql(
    config,
    `begin;
     delete from public.comparison_reports where current_submission_id = ${sqlUuid(state.intentId)} or previous_submission_id = ${sqlUuid(state.intentId)};
     delete from public.feedback_dimension_scores where submission_id = ${sqlUuid(state.intentId)};
     delete from public.sentence_feedback where submission_id = ${sqlUuid(state.intentId)};
     delete from public.writing_feedback where submission_id = ${sqlUuid(state.intentId)};
     delete from public.writing_submission_metrics where submission_id = ${sqlUuid(state.intentId)};
     delete from public.study_events where submission_id = ${sqlUuid(state.intentId)};
     delete from public.library_items where submission_id = ${sqlUuid(state.intentId)};
     delete from public.writing_submissions where id = ${sqlUuid(state.intentId)};
     delete from private.writing_submission_intent_audit where intent_id = ${sqlUuid(state.intentId)};
     delete from private.writing_submission_intents where intent_id = ${sqlUuid(state.intentId)};
     delete from public.writing_drafts where id = ${sqlUuid(state.draftId)};
     commit;`,
  );
}

function collectBrowserFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors: number[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(response.status());
  });
  return { consoleErrors, pageErrors, serverErrors };
}

function buildAnswer(token: string): string {
  const paragraph =
    "온라인 학습 서비스는 학습자의 수준과 목표에 맞는 자료를 제공할 수 있다는 장점이 있다. 그러나 추천 결과만 그대로 따르면 스스로 판단하고 계획하는 힘이 약해질 수 있으므로, 학습자는 자료의 출처와 근거를 확인하고 자신의 경험과 비교해야 한다. 서비스 운영자도 개인정보를 최소한으로 사용하고 추천 이유를 이해하기 쉽게 설명해야 한다. 이런 원칙을 지키면 기술의 편리함과 학습자의 자율성을 함께 높일 수 있다. ";
  const safeParagraph = paragraph.includes("인공지능")
    ? paragraph
    : "인공지능 학습 서비스는 학습자의 수준과 목표에 맞는 자료를 제공할 수 있다는 장점이 있다. 그러나 추천 결과만 그대로 따르면 스스로 판단하고 계획하는 힘이 약해질 수 있으므로 학습자는 자료의 출처와 근거를 확인하고 자신의 경험과 비교해야 한다. 서비스 운영자도 개인정보를 최소한으로 사용하고 추천 이유를 이해하기 쉽게 설명해야 한다. 이런 원칙을 지키면 기술의 편리함과 학습자의 자율성을 함께 높일 수 있다. ";
  return `${token} ${safeParagraph}${safeParagraph}`.slice(0, 620);
}

async function waitForDraft(
  serviceClient: SupabaseClient,
  token: string,
): Promise<string> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await serviceClient
      .from("writing_drafts")
      .select("id")
      .like("answer_text", `%${token}%`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) {
      throw new Error(`provider canary draft lookup: ${result.error.message}`);
    }
    if (result.data?.id) return String(result.data.id);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for provider canary draft.");
}

async function waitForSubmission(
  serviceClient: SupabaseClient,
  token: string,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await serviceClient
      .from("writing_submissions")
      .select(
        "id,draft_id,user_id,problem_id,question_no,feedback_status,external_submission_id,canonical_question_id,canonical_import_id,canonical_payload_hash",
      )
      .like("answer_text", `%${token}%`)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error(`provider canary submission lookup: ${result.error.message}`);
    if (result.data) return result.data;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for provider canary submission.");
}

test.skip(!LIVE, "Explicit provider live E2E opt-in is required.");
test.describe.configure({ retries: 0 });

test("canonical Q54 reaches the real provider and renders persisted feedback", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "The real provider canary runs once on desktop Chromium.",
  );
  test.setTimeout(180_000);

  const config = resolveConfig();
  const serviceClient = client(config.supabaseUrl, config.serviceRoleKey);
  const studentClient = client(config.supabaseUrl, config.anonKey);
  const state: CreatedState = {
    draftId: null,
    intentId: null,
    problemId: null,
    userId: null,
  };
  const browserFailures = collectBrowserFailures(page);
  const token = `provider-canary-${Date.now()}-${testInfo.retry}`;
  const answer = buildAnswer(token);
  expect(answer.length).toBeGreaterThanOrEqual(300);
  expect(answer.length).toBeLessThanOrEqual(700);

  try {
    const signIn = await studentClient.auth.signInWithPassword({
      email: config.studentEmail,
      password: config.studentPassword,
    });
    if (signIn.error || !signIn.data.user) {
      throw new Error(`provider canary student sign-in: ${signIn.error?.message}`);
    }
    state.userId = signIn.data.user.id;

    const canonical = await studentClient.rpc("get_available_writing_questions", {
      p_item_number: 54,
      p_problem_id: null,
    });
    if (canonical.error) {
      throw new Error(`provider canary canonical lookup: ${canonical.error.message}`);
    }
    const rows = (canonical.data ?? []) as CanonicalRow[];
    const ids = rows.map((row) => row.problem_id);
    const [drafts, submissions] = await Promise.all([
      serviceClient
        .from("writing_drafts")
        .select("problem_id")
        .eq("user_id", state.userId)
        .in("problem_id", ids),
      serviceClient
        .from("writing_submissions")
        .select("problem_id")
        .eq("user_id", state.userId)
        .in("problem_id", ids),
    ]);
    if (drafts.error || submissions.error) {
      throw new Error("provider canary occupied-problem lookup failed");
    }
    const occupied = new Set(
      [...(drafts.data ?? []), ...(submissions.data ?? [])].map((row) =>
        String(row.problem_id),
      ),
    );
    const sample = rows.find((row) => !occupied.has(row.problem_id));
    if (!sample) throw new Error("Provider canary requires an unused Q54 question.");
    state.problemId = sample.problem_id;

    await page.goto(
      `/writing/essay-writing-54?problem=${encodeURIComponent(sample.problem_id)}&fresh=1`,
      { waitUntil: "networkidle" },
    );
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId("q54-composer-write-panel")).toBeVisible();
    expect(
      await page.locator("[data-nextjs-dialog], .vite-error-overlay").count(),
    ).toBe(0);

    const answerBox = page
      .getByTestId("q54-composer-write-panel")
      .locator("textarea");
    await answerBox.fill(answer);
    await page.locator(".writing-exam-header__save-button").click();
    state.draftId = await waitForDraft(serviceClient, token);
    const submitButton = page.locator(".writing-exam-header__submit-button");
    await expect(submitButton).toBeEnabled({ timeout: 20_000 });
    await submitButton.click();
    await expect(page.getByTestId("submission-confirm-modal")).toBeVisible();
    await page.getByTestId("submission-confirm-submit").click();
    await expect(page.getByTestId("analysis-loading-page")).toBeVisible({
      timeout: 30_000,
    });

    const submission = await waitForSubmission(serviceClient, token);
    state.intentId = String(submission.id);
    state.draftId = String(submission.draft_id);
    expect(submission.question_no).toBe(54);
    expect(submission.canonical_question_id).toBe(sample.question_id);
    expect(String(submission.canonical_import_id)).toBe(
      String(sample.canonical_import_id),
    );
    expect(submission.canonical_payload_hash).toBe(sample.payload_hash);
    expect(submission.external_submission_id).not.toBe(submission.id);

    let finalStatus: string | null = null;
    const statusDeadline = Date.now() + 120_000;
    while (Date.now() < statusDeadline) {
      const statusResult = await page.evaluate(async (submissionId) => {
        const response = await fetch(
          `/api/writing/evaluation-status?submissionId=${encodeURIComponent(submissionId)}`,
          { cache: "no-store" },
        );
        const body = (await response.json()) as {
          feedback_status?: string;
        };
        return { body, status: response.status };
      }, state.intentId);
      expect(statusResult.status).toBeLessThan(500);
      finalStatus = statusResult.body.feedback_status ?? null;
      if (finalStatus === "complete" || finalStatus === "failed") break;
      await page.waitForTimeout(5_000);
    }
    expect(finalStatus).toBe("complete");

    await page.goto(`/writing/feedback/long/${state.intentId}`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByTestId("feedback-summary")).toBeVisible({
      timeout: 20_000,
    });

    const [feedback, dimensions, intentAudit] = await Promise.all([
      serviceClient
        .from("writing_feedback")
        .select("status,score_total,score_max")
        .eq("submission_id", state.intentId)
        .single(),
      serviceClient
        .from("feedback_dimension_scores")
        .select("dimension")
        .eq("submission_id", state.intentId),
      serviceClient.rpc("list_writing_submission_intent_audit", {
        p_intent_id: state.intentId,
      }),
    ]);
    if (feedback.error || dimensions.error || intentAudit.error) {
      throw new Error("Provider canary persisted feedback verification failed.");
    }
    expect(feedback.data.status).toBe("complete");
    expect(dimensions.data.length).toBeGreaterThan(0);
    expect(intentAudit.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ new_state: "materialized" }),
      ]),
    );

    expect(browserFailures.pageErrors).toEqual([]);
    expect(browserFailures.consoleErrors).toEqual([]);
    expect(browserFailures.serverErrors).toEqual([]);
    mkdirSync(dirname(config.screenshotPath), { recursive: true });
    await page.screenshot({ fullPage: true, path: config.screenshotPath });

    const cleanupIntentId = state.intentId;
    const cleanupDraftId = state.draftId;
    await cleanup(config, state);
    const cleanupEvidence = await managementSql(
      config,
      `select jsonb_build_object(
        'intent', (select count(*) from private.writing_submission_intents where intent_id = ${sqlUuid(cleanupIntentId)}),
        'audit', (select count(*) from private.writing_submission_intent_audit where intent_id = ${sqlUuid(cleanupIntentId)}),
        'submission', (select count(*) from public.writing_submissions where id = ${sqlUuid(cleanupIntentId)}),
        'draft', (select count(*) from public.writing_drafts where id = ${sqlUuid(cleanupDraftId)})
      ) as evidence;`,
    );
    expect(cleanupEvidence[0]?.evidence).toEqual({
      audit: 0,
      draft: 0,
      intent: 0,
      submission: 0,
    });
    state.intentId = null;
    state.draftId = null;

    const report = {
      browser: {
        consoleErrors: browserFailures.consoleErrors.length,
        pageErrors: browserFailures.pageErrors.length,
        serverErrors: browserFailures.serverErrors.length,
      },
      cleanup: "complete",
      externalIdSeparated: true,
      feedback: {
        dimensionCount: dimensions.data.length,
        persisted: true,
        status: feedback.data.status,
      },
      projectRefHash: createHash("sha256")
        .update(config.projectRef)
        .digest("hex"),
      schemaVersion: 1,
      verifiedAt: new Date().toISOString(),
    };
    mkdirSync(dirname(config.reportPath), { recursive: true });
    writeFileSync(config.reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } finally {
    await cleanup(config, state);
  }
});
