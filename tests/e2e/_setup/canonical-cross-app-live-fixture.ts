import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
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

type SubmissionControl = {
  submission_contract_state:
    | "unverified"
    | "provider_verified"
    | "local_outbox_verified";
  submission_mode: "blocked" | "verification" | "canonical";
};

type CanonicalQuestion = {
  canonical_import_id: number | string;
  item_number: number;
  materials: Record<string, unknown> | null;
  payload_hash: string;
  problem_id: string;
  prompt: string | null;
  question_id: string;
  title: string | null;
};

export type WritingQuestionNo = 51 | 52 | 53 | 54;

type CronJobRow = {
  active: boolean;
  command: string;
  jobid: number;
  jobname: string;
  schedule: string;
};

type ManagementQueryResponse =
  | Array<Record<string, unknown>>
  | { result?: Array<Record<string, unknown>> };

export type CanonicalLiveConfig = {
  adminBaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  anonKey: string;
  baseUrl: string;
  existingHistorySubmissionId: string;
  projectRef: string;
  serviceRoleKey: string;
  studentEmail: string;
  studentPassword: string;
  supabaseAccessToken: string;
  supabaseUrl: string;
};

export type CanonicalLiveFixture = {
  adminClient: SupabaseClient;
  adminUserId: string;
  canonicalImportId: number;
  canonicalQuestion: CanonicalQuestion;
  canonicalSamples: Record<WritingQuestionNo, CanonicalQuestion>;
  config: CanonicalLiveConfig;
  historyHref: string;
  historySubmissionId: string;
  marker: string;
  problemId: string;
  questionId: string;
  serviceClient: SupabaseClient;
  studentClient: SupabaseClient;
  studentUserId: string;
};

export type WritingUpstreamFixture = {
  canonicalImportId: number | null;
  close: () => Promise<void>;
  marker: string;
  problemId: string;
  questionId: string;
  requests: string[];
};

function required(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required for canonical live E2E.`);
  return value;
}

function localUrl(value: string, key: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`${key} must be a local http URL, received ${url.origin}.`);
  }
  return url.origin;
}

export function canonicalLiveEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.E2E_CANONICAL_CROSS_APP === "1";
}

export function resolveCanonicalLiveConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): CanonicalLiveConfig {
  if (!canonicalLiveEnabled(env)) {
    throw new Error(
      "E2E_CANONICAL_CROSS_APP=1 is required for this live suite.",
    );
  }
  if (env.E2E_ALLOW_DEV_DB_MUTATION !== "1") {
    throw new Error(
      "E2E_ALLOW_DEV_DB_MUTATION=1 is required before creating isolated fixtures.",
    );
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Canonical live E2E refuses NODE_ENV=production.");
  }

  const label = required(env, "SUPABASE_ENV_LABEL").toLowerCase();
  if (!SAFE_ENV_LABELS.has(label)) {
    throw new Error(
      `SUPABASE_ENV_LABEL must be explicitly non-production, received ${label}.`,
    );
  }

  const supabaseUrl = required(env, "NEXT_PUBLIC_SUPABASE_URL");
  const projectRef = required(env, "SUPABASE_PROJECT_REF");
  if (!/^[a-z0-9]+$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF has an unexpected format.");
  }
  const supabaseHost = new URL(supabaseUrl).hostname;
  const urlProjectRef = supabaseHost.endsWith(".supabase.co")
    ? supabaseHost.slice(0, -".supabase.co".length)
    : null;
  if (!urlProjectRef || urlProjectRef !== projectRef) {
    throw new Error(
      "SUPABASE_PROJECT_REF must match NEXT_PUBLIC_SUPABASE_URL before live DB mutation.",
    );
  }

  return {
    adminBaseUrl: localUrl(
      env.E2E_ADMIN_BASE_URL?.trim() || "http://127.0.0.1:4178",
      "E2E_ADMIN_BASE_URL",
    ),
    adminEmail: required(env, "E2E_ADMIN_EMAIL"),
    adminPassword: required(env, "E2E_ADMIN_PASSWORD"),
    anonKey:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      required(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    baseUrl: localUrl(
      env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3113",
      "E2E_BASE_URL",
    ),
    existingHistorySubmissionId: required(
      env,
      "E2E_EXISTING_HISTORY_SUBMISSION_ID",
    ),
    projectRef,
    serviceRoleKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
    studentEmail: required(env, "E2E_STUDENT_EMAIL"),
    studentPassword:
      env.E2E_STUDENT_PASSWORD?.trim() ||
      required(env, "SUPABASE_TEST_PASSWORD"),
    supabaseAccessToken: required(env, "SUPABASE_ACCESS_TOKEN"),
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

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

async function signIn(
  authClient: SupabaseClient,
  email: string,
  password: string,
  role: "admin" | "student",
): Promise<string> {
  const result = await authClient.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error(`${role} sign-in: ${result.error.message}`);
  if (!result.data.user) throw new Error(`${role} sign-in returned no user.`);
  return result.data.user.id;
}

async function loadSubmissionControl(
  studentClient: SupabaseClient,
): Promise<SubmissionControl> {
  const result = await studentClient.rpc("get_writing_submission_control");
  if (result.error)
    throw new Error(`get_writing_submission_control: ${result.error.message}`);
  const row = (
    Array.isArray(result.data) ? result.data[0] : result.data
  ) as SubmissionControl | null;
  if (!row) throw new Error("get_writing_submission_control returned no row.");
  return row;
}

async function loadHistoryHref(
  serviceClient: SupabaseClient,
  studentUserId: string,
  submissionId: string,
): Promise<string> {
  const submission = await serviceClient
    .from("writing_submissions")
    .select("id,problem_id,question_no,feedback_status")
    .eq("id", submissionId)
    .eq("user_id", studentUserId)
    .maybeSingle();
  if (submission.error) {
    throw new Error(`history submission lookup: ${submission.error.message}`);
  }
  if (!submission.data) {
    throw new Error(
      "E2E_EXISTING_HISTORY_SUBMISSION_ID must identify a retained submission owned by E2E_STUDENT_EMAIL.",
    );
  }

  const questionNo = Number(submission.data.question_no);
  if (![51, 52, 53, 54].includes(questionNo)) {
    throw new Error(
      "The retained history submission must be a Q51-Q54 writing record.",
    );
  }
  if (submission.data.feedback_status === "failed") {
    throw new Error(
      "E2E_EXISTING_HISTORY_SUBMISSION_ID must be PDF-eligible; failed analysis records are retained history but cannot produce a PDF.",
    );
  }
  const feedbackKind = questionNo <= 52 ? "short" : "long";
  return `/writing/feedback/${feedbackKind}/${submissionId}`;
}

async function loadTemplate(
  serviceClient: SupabaseClient,
): Promise<Record<string, unknown>> {
  const result = await serviceClient
    .from("topik_writing_question_import")
    .select("raw_payload")
    .eq("item_number", 51)
    .eq("mapping_status", "promoted")
    .not("promoted_question_id", "is", null)
    .order("import_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error)
    throw new Error(`canonical template lookup: ${result.error.message}`);
  if (!result.data) {
    throw new Error(
      "A promoted Q51 import is required as the schema-complete fixture template.",
    );
  }
  return objectValue(result.data.raw_payload, "Q51 import raw_payload");
}

async function loadCanonicalQuestion(
  studentClient: SupabaseClient,
  problemId: string,
  itemNumber: WritingQuestionNo = 51,
): Promise<CanonicalQuestion> {
  const result = await studentClient.rpc("get_available_writing_questions", {
    p_item_number: itemNumber,
    p_problem_id: problemId,
  });
  if (result.error) {
    throw new Error(`get_available_writing_questions: ${result.error.message}`);
  }
  const row = (
    Array.isArray(result.data) ? result.data[0] : result.data
  ) as CanonicalQuestion | null;
  if (!row)
    throw new Error(
      "Promoted fixture is not learner-visible in canonical RPC.",
    );
  return row;
}

function hasSupportedChart(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSupportedChart);
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  if (
    typeof record.chart_type === "string" &&
    ["bar", "donut", "line", "pie"].includes(record.chart_type)
  ) {
    return true;
  }
  return Object.values(record).some(hasSupportedChart);
}

async function loadCanonicalSamples(
  studentClient: SupabaseClient,
  q51: CanonicalQuestion,
): Promise<Record<WritingQuestionNo, CanonicalQuestion>> {
  const samples = { 51: q51 } as Record<WritingQuestionNo, CanonicalQuestion>;

  for (const itemNumber of [52, 53, 54] as const) {
    const result = await studentClient.rpc("get_available_writing_questions", {
      p_item_number: itemNumber,
      p_problem_id: null,
    });
    if (result.error) {
      throw new Error(
        `get_available_writing_questions(Q${itemNumber}): ${result.error.message}`,
      );
    }
    const rows = (result.data ?? []) as CanonicalQuestion[];
    const sample =
      itemNumber === 53
        ? rows.find((row) => hasSupportedChart(row.materials))
        : rows[0];
    if (!sample) {
      throw new Error(
        itemNumber === 53
          ? "Canonical Q53 acceptance requires a learner-visible problem with a supported chart."
          : `Canonical Q${itemNumber} acceptance requires at least one learner-visible problem.`,
      );
    }
    samples[itemNumber] = sample;
  }

  return samples;
}

function problemIdForQuestionId(questionId: string): string {
  const hex = createHash("md5").update(questionId).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function sendJson(
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function startWritingUpstreamFixture(
  fixture: CanonicalLiveFixture,
  upstreamBaseUrl: string,
): Promise<WritingUpstreamFixture> {
  const origin = localUrl(upstreamBaseUrl, "E2E_WRITING_UPSTREAM_BASE_URL");
  const url = new URL(origin);
  const port = Number(url.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("E2E_WRITING_UPSTREAM_BASE_URL must include a port.");
  }

  const template = await loadTemplate(fixture.serviceClient);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const questionId = `e2e-browser-ingest-51-${Date.now()}-${suffix}`;
  const marker = `[E2E browser ingest ${suffix}]`;
  const payload = {
    ...template,
    item_number: 51,
    prompt_text: `${marker}\n${String(template.prompt_text ?? "문장을 완성하세요.")}`,
    question_id: questionId,
    review_status: "검수 완료",
    service_status: "internal_test",
    situation_summary: marker,
    title: `${marker} ${String(template.title ?? "writing question")}`,
  };
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", origin);
    requests.push(
      `${request.method ?? "GET"} ${requestUrl.pathname}${requestUrl.search}`,
    );

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/eval/auth/login"
    ) {
      sendJson(response, 200, { token: "local-writing-e2e-token" });
      return;
    }
    if (
      request.method === "GET" &&
      requestUrl.pathname.startsWith("/api/writing/tasks/")
    ) {
      if (request.headers.authorization !== "Bearer local-writing-e2e-token") {
        sendJson(response, 401, { error: "unauthorized" });
        return;
      }
      const items = requestUrl.pathname.endsWith("/Q51") ? [payload] : [];
      sendJson(response, 200, { items });
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, url.hostname, () => {
      server.off("error", onError);
      resolve();
    });
  });

  return {
    canonicalImportId: null,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    marker,
    problemId: problemIdForQuestionId(questionId),
    questionId,
    requests,
  };
}

export async function createCanonicalLiveFixture(
  config: CanonicalLiveConfig,
): Promise<CanonicalLiveFixture> {
  const serviceClient = client(config.supabaseUrl, config.serviceRoleKey);
  const adminClient = client(config.supabaseUrl, config.anonKey);
  const studentClient = client(config.supabaseUrl, config.anonKey);
  const adminUserId = await signIn(
    adminClient,
    config.adminEmail,
    config.adminPassword,
    "admin",
  );
  const studentUserId = await signIn(
    studentClient,
    config.studentEmail,
    config.studentPassword,
    "student",
  );

  const adminAccount = await serviceClient
    .from("admin_accounts")
    .select("id,role,status")
    .eq("id", adminUserId)
    .in("role", ["platform_admin", "content_admin"])
    .eq("status", "active")
    .maybeSingle();
  if (adminAccount.error)
    throw new Error(`admin account lookup: ${adminAccount.error.message}`);
  if (!adminAccount.data) {
    throw new Error(
      "E2E admin must be an active platform_admin or content_admin.",
    );
  }

  const submissionControl = await loadSubmissionControl(studentClient);
  if (submissionControl.submission_mode !== "blocked") {
    throw new Error(
      `Live suite requires blocked submissions, received ${submissionControl.submission_mode}.`,
    );
  }

  const historyHref = await loadHistoryHref(
    serviceClient,
    studentUserId,
    config.existingHistorySubmissionId,
  );
  const template = await loadTemplate(serviceClient);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const questionId = `e2e-canonical-51-${Date.now()}-${suffix}`;
  const expectedProblemId = problemIdForQuestionId(questionId);
  const marker = `[E2E canonical direct ${suffix}]`;
  const rawPayload = {
    ...template,
    item_number: 51,
    prompt_text: `${marker}\n${String(template.prompt_text ?? "문장을 완성하세요.")}`,
    question_id: questionId,
    review_status: "검수 완료",
    service_status: "internal_test",
    situation_summary: marker,
    title: `${marker} ${String(template.title ?? "writing question")}`,
  };
  const rawResponseText = JSON.stringify(rawPayload);

  try {
    const ingest = await serviceClient.rpc("admin_ingest_writing_task", {
      p_actor_id: adminUserId,
      p_item_number: 51,
      p_raw_payload: rawPayload,
      p_raw_response_text: rawResponseText,
      p_source_endpoint: "/e2e/canonical-cross-app-live",
      p_source_task_id: questionId,
    });
    if (ingest.error)
      throw new Error(`admin_ingest_writing_task: ${ingest.error.message}`);

    const promote = await serviceClient.rpc("admin_promote_writing_questions", {
      p_actor_id: adminUserId,
      p_question_ids: [questionId],
    });
    if (promote.error)
      throw new Error(
        `admin_promote_writing_questions: ${promote.error.message}`,
      );
    const promotion = objectValue(promote.data, "promotion result");
    if (
      Number(promotion.held ?? 0) !== 0 ||
      Number(promotion.promoted_new ?? 0) !== 1
    ) {
      throw new Error(
        `Unexpected promotion result: ${JSON.stringify(promotion)}`,
      );
    }

    const available = await adminClient.rpc("admin_update_topik_question", {
      p_item_number: 51,
      p_patch: {
        __note: `e2e ${suffix}: canonical direct-read visibility`,
        service_status: "available",
      },
      p_question_id: questionId,
    });
    if (available.error)
      throw new Error(
        `admin_update_topik_question: ${available.error.message}`,
      );

    const sourceMap = await serviceClient
      .from("topik_writing_question_source_map")
      .select("learner_problem_id,canonical_import_id")
      .eq("question_id", questionId)
      .single();
    if (sourceMap.error)
      throw new Error(`source map lookup: ${sourceMap.error.message}`);
    const problemId = String(sourceMap.data.learner_problem_id);
    const canonicalImportId = Number(sourceMap.data.canonical_import_id);
    if (
      problemId !== expectedProblemId ||
      !Number.isSafeInteger(canonicalImportId)
    ) {
      throw new Error(
        "Source map did not return deterministic identity and exact import pin.",
      );
    }

    const canonicalQuestion = await loadCanonicalQuestion(
      studentClient,
      problemId,
    );
    if (
      canonicalQuestion.question_id !== questionId ||
      Number(canonicalQuestion.canonical_import_id) !== canonicalImportId ||
      canonicalQuestion.payload_hash !==
        createHash("md5").update(rawResponseText).digest("hex")
    ) {
      throw new Error(
        "Canonical learner RPC identity/version/hash did not match the ingested fixture.",
      );
    }
    const canonicalSamples = await loadCanonicalSamples(
      studentClient,
      canonicalQuestion,
    );

    return {
      adminClient,
      adminUserId,
      canonicalImportId,
      canonicalQuestion,
      canonicalSamples,
      config,
      historyHref,
      historySubmissionId: config.existingHistorySubmissionId,
      marker,
      problemId,
      questionId,
      serviceClient,
      studentClient,
      studentUserId,
    };
  } catch (error) {
    try {
      await cleanupCanonicalIdentity({
        config,
        problemId: expectedProblemId,
        questionId,
        serviceClient,
        studentUserId,
      });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Canonical live fixture creation and partial cleanup both failed.",
      );
    }
    throw error;
  }
}

async function deleteByProblem(
  serviceClient: SupabaseClient,
  table: string,
  problemId: string,
): Promise<void> {
  const result = await serviceClient
    .from(table)
    .delete()
    .eq("problem_id", problemId);
  if (result.error)
    throw new Error(`${table} cleanup: ${result.error.message}`);
}

export async function cleanupCanonicalIdentity({
  config,
  problemId,
  questionId,
  serviceClient,
  studentUserId,
}: {
  config: CanonicalLiveConfig;
  problemId: string;
  questionId: string;
  serviceClient: SupabaseClient;
  studentUserId: string;
}): Promise<void> {
  const submissions = await serviceClient
    .from("writing_submissions")
    .select("id")
    .eq("problem_id", problemId)
    .eq("user_id", studentUserId);
  if (submissions.error)
    throw new Error(
      `fixture submission cleanup lookup: ${submissions.error.message}`,
    );
  const submissionIds = (submissions.data ?? []).map((row) => String(row.id));
  if (submissionIds.length > 0) {
    for (const table of [
      "feedback_dimension_scores",
      "sentence_feedback",
      "writing_feedback",
      "writing_submission_metrics",
    ]) {
      const deleted = await serviceClient
        .from(table)
        .delete()
        .in("submission_id", submissionIds);
      if (deleted.error)
        throw new Error(`${table} cleanup: ${deleted.error.message}`);
    }
    const library = await serviceClient
      .from("library_items")
      .delete()
      .in("submission_id", submissionIds);
    if (library.error)
      throw new Error(`library submission cleanup: ${library.error.message}`);
    const deleted = await serviceClient
      .from("writing_submissions")
      .delete()
      .in("id", submissionIds);
    if (deleted.error)
      throw new Error(`writing_submissions cleanup: ${deleted.error.message}`);
  }

  for (const table of [
    "writing_drafts",
    "problem_attempts",
    "recommendation_items",
    "library_items",
    "study_events",
    "problem_assets",
  ]) {
    await deleteByProblem(serviceClient, table, problemId);
  }

  // The production guard intentionally rejects canonical question deletion.
  // Delete the canonical identity as one dev-only transaction so an interrupted
  // cleanup cannot leave an available question without its source-map row.
  // resolveCanonicalLiveConfig already requires local app URLs, a non-production
  // label, explicit mutation opt-in, and a matching Management project ref.
  await managementSql(
    config,
    `begin;
     set local session_replication_role = replica;
     delete from private.problem_identities
      where problem_id = ${sqlLiteral(problemId)}::uuid
        and domain = 'writing';
     delete from public.topik_writing_51_questions
      where question_id = ${sqlLiteral(questionId)};
     delete from public.topik_writing_question_source_map
      where question_id = ${sqlLiteral(questionId)};
     delete from public.topik_writing_question_import
      where source_task_id = ${sqlLiteral(questionId)};
     commit;`,
  );
}

export async function cleanupCanonicalLiveFixture(
  fixture: CanonicalLiveFixture,
): Promise<void> {
  await cleanupCanonicalIdentity(fixture);
}

export async function setFixtureAvailability(
  fixture: CanonicalLiveFixture,
  status: "available" | "excluded",
  reason: string,
): Promise<void> {
  const result = await fixture.adminClient.rpc("admin_update_topik_question", {
    p_item_number: 51,
    p_patch: { __note: reason, service_status: status },
    p_question_id: fixture.questionId,
  });
  if (result.error)
    throw new Error(`fixture availability ${status}: ${result.error.message}`);
}

export async function managementSql(
  config: CanonicalLiveConfig,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${config.projectRef}/database/query`,
    {
      body: JSON.stringify({ query: sql }),
      headers: {
        Authorization: `Bearer ${config.supabaseAccessToken}`,
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
  const payload = (await response.json()) as ManagementQueryResponse;
  return Array.isArray(payload) ? payload : (payload.result ?? []);
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function loadCronJobs(
  config: CanonicalLiveConfig,
): Promise<CronJobRow[]> {
  const rows = await managementSql(
    config,
    "select jobid, jobname, schedule, command, active from cron.job order by jobid",
  );
  return rows as unknown as CronJobRow[];
}

export function cronDigest(rows: CronJobRow[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map(({ active, command, jobid, jobname, schedule }) => ({
          active,
          command,
          jobid,
          jobname,
          schedule,
        })),
      ),
    )
    .digest("hex");
}
