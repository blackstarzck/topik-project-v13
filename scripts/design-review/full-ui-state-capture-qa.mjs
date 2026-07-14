import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import {
  prepareEvidenceOutputDirectory,
  resolveEvidenceOutput,
  requireEvidenceSlug,
} from "./evidence-paths.mjs";

const cwd = process.cwd();
const evidenceSlug = requireEvidenceSlug(process.env.UI_EVIDENCE_SLUG);
const baseUrl = "http://127.0.0.1:3000";
const viewports = [
  { name: "mobile", width: 360, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];
const startedAt = new Date();
const pad = (n) => String(n).padStart(2, "0");
const runId = `${startedAt.getFullYear()}${pad(startedAt.getMonth() + 1)}${pad(startedAt.getDate())}-${pad(startedAt.getHours())}${pad(startedAt.getMinutes())}${pad(startedAt.getSeconds())}`;
const marker = `full-ui-capture-${runId}-${randomUUID().slice(0, 8)}`;
const authStatePath = path.join(cwd, "tests", "e2e", "auth-state", "student.json");
const reportChild = `full-ui-state-capture-${runId}`;
const reportDir = resolveEvidenceOutput({
  cwd,
  slug: evidenceSlug,
  child: reportChild,
});
const manifestPath = path.join(reportDir, `manifest-${runId}.json`);
const reportPath = path.join(reportDir, `report-${runId}.md`);

function emit(event, data = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }));
}

function loadEnvLocal() {
  const env = {};
  const raw = fsSync.readFileSync(path.join(cwd, ".env.local"), "utf8");
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
    process.env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const envLabel = String(env.SUPABASE_ENV_LABEL || "").toLowerCase();
if (envLabel === "prod" || envLabel === "production") {
  throw new Error("Production Supabase environment detected; capture fixture creation is blocked.");
}
if (!fsSync.existsSync(authStatePath)) {
  throw new Error(`Missing auth storage state: ${authStatePath}`);
}
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase service credentials for dynamic capture fixtures.");
}
const studentEmail = env.E2E_STUDENT_EMAIL;
if (!studentEmail) throw new Error("Missing E2E_STUDENT_EMAIL.");
const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY;

const cleanup = {
  submissionIds: [],
  reportIds: [],
  runIds: [],
  exportIds: [],
  libraryItemIds: [],
  draftSnapshots: new Map(),
  userId: null,
};

async function must(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function getUserId() {
  if (cleanup.userId) return cleanup.userId;
  if (anonKey && env.SUPABASE_TEST_PASSWORD) {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
    const signedIn = await authClient.auth.signInWithPassword({
      email: studentEmail,
      password: env.SUPABASE_TEST_PASSWORD,
    });
    if (!signedIn.error && signedIn.data.user?.id) {
      cleanup.userId = signedIn.data.user.id;
      return cleanup.userId;
    }
  }
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(`list users: ${users.error.message}`);
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === studentEmail.toLowerCase(),
  );
  if (!user) throw new Error("E2E student user not found.");
  cleanup.userId = user.id;
  return user.id;
}

async function publishedProblems(questionNo = null, limit = 25) {
  let query = sb
    .from("problems")
    .select("id, title, question_no")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (questionNo != null) query = query.eq("question_no", questionNo);
  const data = await must(`published problems ${questionNo ?? "any"}`, query);
  if (!data || data.length === 0) {
    throw new Error(`No published writing problem found for ${questionNo ?? "any question"}`);
  }
  return data;
}

async function snapshotDraft(problemId) {
  if (cleanup.draftSnapshots.has(problemId)) return cleanup.draftSnapshots.get(problemId);
  const userId = await getUserId();
  const res = await sb
    .from("writing_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .neq("autosave_status", "superseded")
    .maybeSingle();
  if (res.error) throw new Error(`snapshot draft: ${res.error.message}`);
  cleanup.draftSnapshots.set(problemId, res.data ?? null);
  return res.data ?? null;
}

async function chooseProblem(questionNo = null) {
  const problems = await publishedProblems(questionNo, 25);
  const userId = await getUserId();
  const ids = problems.map((p) => p.id);
  const draftRes = await sb
    .from("writing_drafts")
    .select("problem_id")
    .eq("user_id", userId)
    .neq("autosave_status", "superseded")
    .in("problem_id", ids);
  if (draftRes.error) throw new Error(`choose problem drafts: ${draftRes.error.message}`);
  const drafted = new Set((draftRes.data ?? []).map((d) => d.problem_id));
  const selected = problems.find((p) => !drafted.has(p.id)) ?? problems[0];
  await snapshotDraft(selected.id);
  return selected;
}

const dimensions = [
  ["grammar", 78, 3],
  ["vocab", 82, 2],
  ["structure", 74, 3],
  ["content", 86, 1],
  ["expression", 80, 2],
  ["topic_fit", 88, 1],
];

async function createCompletedFeedback(questionNo, kind) {
  const userId = await getUserId();
  const problem = await chooseProblem(questionNo);
  const submissionId = randomUUID();
  const answerText = `${marker} ${kind} completed answer. This fixture gives the feedback screen stable visible content for responsive screenshots.`;
  await must(
    `${kind} submission`,
    sb.from("writing_submissions").insert({
      id: submissionId,
      user_id: userId,
      problem_id: problem.id,
      question_no: questionNo,
      answer_text: answerText,
      char_count: answerText.length,
      feedback_status: "complete",
    }),
  );
  cleanup.submissionIds.push(submissionId);
  await must(
    `${kind} feedback`,
    sb.from("writing_feedback").insert({
      submission_id: submissionId,
      user_id: userId,
      status: "complete",
      score_total: questionNo <= 52 ? 82 : 74,
      score_max: 100,
      overall_summary: `${kind} fixture summary for the full UI state capture run. The response has clear structure and several focused improvement points.`,
      ai_model: "full-ui-capture-fixture",
      ai_model_version: runId,
    }),
  );
  await must(
    `${kind} dimensions`,
    sb.from("feedback_dimension_scores").insert(
      dimensions.map(([dimension, score, weakness]) => ({
        submission_id: submissionId,
        user_id: userId,
        dimension,
        score: Number(score),
        score_max: 100,
        summary: `${dimension} fixture note for screenshot review.`,
        weakness_level: Number(weakness),
      })),
    ),
  );
  const sentenceCount = questionNo <= 52 ? 2 : 6;
  await must(
    `${kind} sentences`,
    sb.from("sentence_feedback").insert(
      Array.from({ length: sentenceCount }, (_, index) => ({
        submission_id: submissionId,
        user_id: userId,
        sentence_index: index,
        original_text: `${marker} original sentence ${index + 1}.`,
        corrected_text: `${marker} corrected sentence ${index + 1}.`,
        comment: `Fixture sentence comment ${index + 1}.`,
      })),
    ),
  );
  return { submissionId, problemId: problem.id, questionNo };
}

async function createPendingSubmission() {
  const userId = await getUserId();
  const problem = await chooseProblem(51);
  const submissionId = randomUUID();
  const answerText = `${marker} pending analysis answer. The modal should render over this submitted text while AI analysis is running.`;
  await must(
    "pending submission",
    sb.from("writing_submissions").insert({
      id: submissionId,
      user_id: userId,
      problem_id: problem.id,
      question_no: 51,
      answer_text: answerText,
      char_count: answerText.length,
      feedback_status: "analyzing",
    }),
  );
  cleanup.submissionIds.push(submissionId);
  return { submissionId, problemId: problem.id };
}

async function createComparisonReport() {
  const userId = await getUserId();
  const problem = await chooseProblem(53);
  const previousSubmissionId = randomUUID();
  const currentSubmissionId = randomUUID();
  const reportId = randomUUID();
  const previousAnswer = `${marker} previous comparison answer.`;
  const currentAnswer = `${marker} current comparison answer with clearer structure, better support, and stronger conclusion.`;
  await must(
    "comparison submissions",
    sb.from("writing_submissions").insert([
      {
        id: previousSubmissionId,
        user_id: userId,
        problem_id: problem.id,
        question_no: 53,
        answer_text: previousAnswer,
        char_count: previousAnswer.length,
        feedback_status: "complete",
        submitted_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
      {
        id: currentSubmissionId,
        user_id: userId,
        problem_id: problem.id,
        question_no: 53,
        answer_text: currentAnswer,
        char_count: currentAnswer.length,
        feedback_status: "complete",
        parent_submission_id: previousSubmissionId,
        submitted_at: new Date().toISOString(),
      },
    ]),
  );
  cleanup.submissionIds.push(previousSubmissionId, currentSubmissionId);
  await must(
    "comparison feedback",
    sb.from("writing_feedback").insert([
      {
        submission_id: previousSubmissionId,
        user_id: userId,
        status: "complete",
        score_total: 68,
        score_max: 100,
        overall_summary: "Previous answer identified the trend but had limited support.",
        ai_model: "full-ui-capture-fixture",
        ai_model_version: runId,
      },
      {
        submission_id: currentSubmissionId,
        user_id: userId,
        status: "complete",
        score_total: 82,
        score_max: 100,
        overall_summary: "Current answer has clearer structure and stronger support.",
        ai_model: "full-ui-capture-fixture",
        ai_model_version: runId,
      },
    ]),
  );
  await must(
    "comparison dimensions",
    sb.from("feedback_dimension_scores").insert(
      dimensions.flatMap(([dimension, score]) => [
        {
          submission_id: previousSubmissionId,
          user_id: userId,
          dimension,
          score: Math.max(45, Number(score) - 12),
          score_max: 100,
          summary: `Previous ${dimension} baseline.`,
          weakness_level: 3,
        },
        {
          submission_id: currentSubmissionId,
          user_id: userId,
          dimension,
          score: Number(score),
          score_max: 100,
          summary: `Current ${dimension} score.`,
          weakness_level: 2,
        },
      ]),
    ),
  );
  await must(
    "comparison report",
    sb.from("comparison_reports").insert({
      id: reportId,
      user_id: userId,
      current_submission_id: currentSubmissionId,
      previous_submission_id: previousSubmissionId,
      metrics: {
        score_delta: 14,
        dimension_deltas: Object.fromEntries(
          dimensions.map(([dimension, score]) => [
            dimension,
            Number(score) - Math.max(45, Number(score) - 12),
          ]),
        ),
        char_delta: currentAnswer.length - previousAnswer.length,
        no_previous: false,
      },
      narrative:
        "Current answer improved by adding clearer structure and more complete support. Next practice should focus on precise evidence.",
      ai_model: "full-ui-capture-fixture",
    }),
  );
  cleanup.reportIds.push(reportId);
  return { reportId, problemId: problem.id };
}

async function createNextProblemFixture() {
  const userId = await getUserId();
  const problems = await publishedProblems(null, 8);
  if (problems.length < 4) {
    throw new Error("Next problem fixture requires at least four published writing problems.");
  }
  const submissionProblem = problems[0];
  await snapshotDraft(submissionProblem.id);
  const submissionId = randomUUID();
  const runIdFixture = randomUUID();
  const answerText = `${marker} next problem recommendation source answer.`;
  await must(
    "next source submission",
    sb.from("writing_submissions").insert({
      id: submissionId,
      user_id: userId,
      problem_id: submissionProblem.id,
      question_no: submissionProblem.question_no ?? 53,
      answer_text: answerText,
      char_count: answerText.length,
      feedback_status: "complete",
    }),
  );
  cleanup.submissionIds.push(submissionId);
  await must(
    "next source feedback",
    sb.from("writing_feedback").insert({
      submission_id: submissionId,
      user_id: userId,
      status: "complete",
      score_total: 72,
      score_max: 100,
      overall_summary: "Fixture feedback for next-problem recommendation cards.",
      ai_model: "full-ui-capture-fixture",
      ai_model_version: runId,
    }),
  );
  await must(
    "next dimensions",
    sb.from("feedback_dimension_scores").insert([
      {
        submission_id: submissionId,
        user_id: userId,
        dimension: "grammar",
        score: 58,
        score_max: 100,
        summary: "Grammar is the weakest area.",
        weakness_level: 5,
      },
      {
        submission_id: submissionId,
        user_id: userId,
        dimension: "structure",
        score: 66,
        score_max: 100,
        summary: "Structure needs more practice.",
        weakness_level: 4,
      },
      {
        submission_id: submissionId,
        user_id: userId,
        dimension: "content",
        score: 70,
        score_max: 100,
        summary: "Content is acceptable.",
        weakness_level: 3,
      },
    ]),
  );
  await must(
    "recommendation run",
    sb.from("recommendation_runs").insert({
      id: runIdFixture,
      user_id: userId,
      source_type: "next_problem",
      reason_summary: `${marker} next-problem fixture`,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  );
  cleanup.runIds.push(runIdFixture);
  await must(
    "recommendation items",
    sb.from("recommendation_items").insert(
      problems.slice(0, 4).map((problem, index) => ({
        run_id: runIdFixture,
        user_id: userId,
        problem_id: problem.id,
        rank: index + 1,
        reason:
          index === 0
            ? "This problem follows the weakest grammar and structure signals from the latest completed answer."
            : "This alternative keeps the learner near the same writing practice context.",
        estimated_minutes: 12 + index * 3,
        weakness_tags: ["grammar", "structure"],
        status: "active",
      })),
    ),
  );
  return { runId: runIdFixture, submissionId };
}

async function createLibraryFixture() {
  const userId = await getUserId();
  const problem = await chooseProblem(null);
  const submissionId = randomUUID();
  const reportId = randomUUID();
  const exportId = randomUUID();
  const libraryIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const answerText = `${marker} saved library fixture answer.`;
  await must(
    "library submission",
    sb.from("writing_submissions").insert({
      id: submissionId,
      user_id: userId,
      problem_id: problem.id,
      question_no: problem.question_no ?? 53,
      answer_text: answerText,
      char_count: answerText.length,
      feedback_status: "complete",
    }),
  );
  cleanup.submissionIds.push(submissionId);
  await must(
    "library feedback",
    sb.from("writing_feedback").insert({
      submission_id: submissionId,
      user_id: userId,
      status: "complete",
      score_total: 76,
      score_max: 100,
      overall_summary: "Library fixture feedback summary for saved answer rows.",
      ai_model: "full-ui-capture-fixture",
      ai_model_version: runId,
    }),
  );
  await must(
    "library dimensions",
    sb.from("feedback_dimension_scores").insert([
      {
        submission_id: submissionId,
        user_id: userId,
        dimension: "grammar",
        score: 62,
        score_max: 100,
        summary: "Grammar remains the weakest dimension.",
        weakness_level: 5,
      },
      {
        submission_id: submissionId,
        user_id: userId,
        dimension: "content",
        score: 78,
        score_max: 100,
        summary: "Content is acceptable.",
        weakness_level: 2,
      },
    ]),
  );
  await must(
    "library report",
    sb.from("comparison_reports").insert({
      id: reportId,
      user_id: userId,
      current_submission_id: submissionId,
      previous_submission_id: null,
      metrics: { score_delta: 0, no_previous: true },
      narrative: "Library fixture comparison narrative for the report tab.",
      ai_model: "full-ui-capture-fixture",
    }),
  );
  cleanup.reportIds.push(reportId);
  await must(
    "library export",
    sb.from("export_files").insert({
      id: exportId,
      user_id: userId,
      source_type: "library_selection",
      source_id: null,
      storage_path: `browser-print://${marker}`,
      options: { source: "browser_print", marker },
      status: "ready",
      ready_at: new Date().toISOString(),
    }),
  );
  cleanup.exportIds.push(exportId);
  await must(
    "library items",
    sb.from("library_items").insert([
      {
        id: libraryIds[0],
        user_id: userId,
        item_type: "submission",
        submission_id: submissionId,
        tags: [marker],
      },
      {
        id: libraryIds[1],
        user_id: userId,
        item_type: "report",
        report_id: reportId,
        tags: [marker],
      },
      {
        id: libraryIds[2],
        user_id: userId,
        item_type: "problem",
        problem_id: problem.id,
        tags: [marker],
      },
      {
        id: libraryIds[3],
        user_id: userId,
        item_type: "export",
        export_id: exportId,
        tags: [marker],
      },
    ]),
  );
  cleanup.libraryItemIds.push(...libraryIds);
  return { marker, problemId: problem.id, problemTitle: problem.title };
}

async function cleanupFixtures() {
  const cleanupErrors = [];
  async function attempt(label, fn) {
    try {
      const result = await fn();
      if (result?.error) cleanupErrors.push(`${label}: ${result.error.message}`);
    } catch (error) {
      cleanupErrors.push(`${label}: ${error?.message || String(error)}`);
    }
  }
  for (const runIdFixture of cleanup.runIds) {
    await attempt(`recommendation_items ${runIdFixture}`, () =>
      sb.from("recommendation_items").delete().eq("run_id", runIdFixture),
    );
  }
  for (const id of cleanup.libraryItemIds) {
    await attempt(`library_item ${id}`, () => sb.from("library_items").delete().eq("id", id));
  }
  for (const id of cleanup.exportIds) {
    await attempt(`export ${id}`, () => sb.from("export_files").delete().eq("id", id));
  }
  for (const id of cleanup.reportIds) {
    await attempt(`report ${id}`, () => sb.from("comparison_reports").delete().eq("id", id));
  }
  for (const id of cleanup.runIds) {
    await attempt(`run ${id}`, () => sb.from("recommendation_runs").delete().eq("id", id));
  }
  for (const id of cleanup.submissionIds) {
    await attempt(`sentence_feedback ${id}`, () =>
      sb.from("sentence_feedback").delete().eq("submission_id", id),
    );
    await attempt(`dimension_scores ${id}`, () =>
      sb.from("feedback_dimension_scores").delete().eq("submission_id", id),
    );
    await attempt(`writing_feedback ${id}`, () =>
      sb.from("writing_feedback").delete().eq("submission_id", id),
    );
  }
  for (const id of cleanup.submissionIds) {
    await attempt(`submission ${id}`, () => sb.from("writing_submissions").delete().eq("id", id));
  }

  const userId = cleanup.userId;
  if (userId) {
    for (const [problemId, original] of cleanup.draftSnapshots.entries()) {
      if (original?.id) {
        await attempt(`delete marker drafts ${problemId}`, () =>
          sb
            .from("writing_drafts")
            .delete()
            .eq("user_id", userId)
            .eq("problem_id", problemId)
            .neq("id", original.id)
            .like("answer_text", `${marker}%`),
        );
        await attempt(`restore draft ${problemId}`, () =>
          sb
            .from("writing_drafts")
            .update({
              answer_text: original.answer_text,
              answer_json: original.answer_json,
              char_count: original.char_count,
              autosave_status: original.autosave_status,
              last_saved_at: original.last_saved_at,
            })
            .eq("id", original.id),
        );
      } else {
        await attempt(`delete marker draft ${problemId}`, () =>
          sb
            .from("writing_drafts")
            .delete()
            .eq("user_id", userId)
            .eq("problem_id", problemId)
            .like("answer_text", `${marker}%`),
        );
      }
    }
  }
  return cleanupErrors;
}

async function buildMatrix(fixtures) {
  const modalProblem = await chooseProblem(51);
  return [
    { ia: "X-01", folder: "23-X-01-product-landing", route: "/", state: "default", auth: false },
    { ia: "A-01", folder: "01-A-01-sign-up", route: "/sign-up", state: "default", auth: false },
    { ia: "A-02", folder: "02-A-02-login", route: "/login", state: "default", auth: false },
    {
      ia: "A-02",
      folder: "02-A-02-login",
      route: "/login?reason=session_expired",
      state: "session-expired",
      auth: false,
    },
    {
      ia: "X-06",
      folder: "28-X-06-password-reset",
      route: "/password-reset",
      state: "default",
      auth: false,
    },
    {
      ia: "X-16",
      folder: "38-X-16-password-reset-confirm",
      route: "/password-reset/confirm",
      state: "default",
      auth: false,
    },
    {
      ia: "X-11",
      folder: "33-X-11-auth-error",
      route: "/auth/error?reason=unknown",
      state: "unknown",
      auth: false,
    },
    {
      ia: "X-11",
      folder: "33-X-11-auth-error",
      route: "/auth/error?reason=otp_expired&email=student%40example.com&retry_after_seconds=1",
      state: "otp-expired",
      auth: false,
    },
    {
      ia: "X-11",
      folder: "33-X-11-auth-error",
      route: "/auth/error?reason=over_request_rate_limit&retry_after_seconds=60",
      state: "rate-limited",
      auth: false,
    },
    {
      ia: "X-12",
      folder: "34-X-12-auth-verify-email",
      route: "/auth/verify-email",
      state: "default",
      auth: false,
    },
    {
      ia: "X-17",
      folder: "39-X-17-auth-callback-fragment",
      route: "/auth/callback-fragment",
      state: "default",
      auth: false,
    },
    { ia: "X-13", folder: "35-X-13-terms", route: "/terms", state: "default", auth: false },
    {
      ia: "X-14",
      folder: "36-X-14-privacy-policy",
      route: "/privacy",
      state: "default",
      auth: false,
    },
    {
      ia: "X-18",
      folder: "40-X-18-auth-consent",
      route: "/auth/consent?next=/dashboard",
      state: "current-account-redirect",
      auth: true,
      note: "The .env.local student account has already accepted required consent; this captures the actual redirect state.",
    },
    {
      ia: "A-03",
      folder: "03-A-03-learning-goal-setup",
      route: "/onboarding/learning-goal",
      state: "default",
      auth: true,
    },
    { ia: "B-01", folder: "04-B-01-home-dashboard", route: "/dashboard", state: "default", auth: true },
    {
      ia: "C-01",
      folder: "05-C-01-problem-type-recommendations",
      route: "/practice/recommendations",
      state: "default",
      auth: true,
    },
    {
      ia: "C-02",
      folder: "06-C-02-problem-list",
      route: "/practice/problems",
      state: "default",
      auth: true,
    },
    {
      ia: "C-03",
      folder: "07-C-03-retry-modal",
      route: "/practice/problems?solve=solved",
      state: "modal-open",
      auth: true,
      preAction: "retry-modal",
    },
    {
      ia: "D-01",
      folder: "08-D-01-short-answer-writing-51",
      route: "/writing/short-answer-writing-51",
      state: "default",
      auth: true,
    },
    {
      ia: "D-02",
      folder: "09-D-02-answer-writing-52",
      route: "/writing/answer-writing-52",
      state: "default",
      auth: true,
    },
    {
      ia: "D-03",
      folder: "10-D-03-long-form-writing-53",
      route: "/writing/long-form-writing-53",
      state: "default",
      auth: true,
    },
    {
      ia: "D-04",
      folder: "11-D-04-essay-writing-54",
      route: "/writing/essay-writing-54",
      state: "default",
      auth: true,
    },
    {
      ia: "D-M1",
      folder: "12-D-M1-submission-confirmation-modal",
      route: `/writing/short-answer-writing-51?problem=${modalProblem.id}&fresh=1`,
      state: "modal-open",
      auth: true,
      preAction: "submission-confirm",
      draftProblemId: modalProblem.id,
    },
    {
      ia: "D-M2",
      folder: "13-D-M2-ai-analysis-loading",
      route: `/writing/feedback/short/${fixtures.pending.submissionId}`,
      state: "analyzing",
      auth: true,
    },
    {
      ia: "D-M3",
      folder: "22-D-M3-autosave-warning",
      route: `/writing/short-answer-writing-51?problem=${modalProblem.id}&fresh=1`,
      state: "modal-open",
      auth: true,
      preAction: "autosave-warning",
      draftProblemId: modalProblem.id,
    },
    {
      ia: "E-01",
      folder: "14-E-01-short-answer-feedback",
      route: `/writing/feedback/short/${fixtures.short.submissionId}`,
      state: "complete",
      auth: true,
    },
    {
      ia: "E-02",
      folder: "15-E-02-long-form-feedback",
      route: `/writing/feedback/long/${fixtures.long.submissionId}`,
      state: "complete",
      auth: true,
    },
    {
      ia: "R-01",
      folder: "16-R-01-comparison-report",
      route: `/writing/reports/${fixtures.comparison.reportId}/compare`,
      state: "default",
      auth: true,
    },
    {
      ia: "R-02",
      folder: "17-R-02-next-problem-recommendation",
      route: "/practice/next",
      state: "default",
      auth: true,
    },
    { ia: "F-01", folder: "18-F-01-my-library", route: "/library", state: "default", auth: true },
    {
      ia: "F-M1",
      folder: "19-F-M1-pdf-export-modal",
      route: "/library",
      state: "modal-open",
      auth: true,
      preAction: "pdf-export-modal",
    },
    {
      ia: "G-01",
      folder: "20-G-01-language-settings",
      route: "/settings/language",
      state: "default",
      auth: true,
    },
    { ia: "X-02", folder: "24-X-02-growth-dashboard", route: "/growth", state: "default", auth: true },
    { ia: "X-03", folder: "25-X-03-paywall", route: "/paywall", state: "default", auth: true },
    {
      ia: "X-04",
      folder: "26-X-04-subscription-management",
      route: "/subscription",
      state: "default",
      auth: true,
    },
    { ia: "X-05", folder: "27-X-05-profile-editing", route: "/profile", state: "default", auth: true },
    {
      ia: "X-07",
      folder: "29-X-07-weakness-based-recommendations",
      route: "/practice/weakness",
      state: "default",
      auth: true,
    },
    {
      ia: "X-09",
      folder: "31-X-09-notification-settings",
      route: "/settings/notifications",
      state: "default",
      auth: true,
    },
  ];
}

async function runPreAction(page, item, fixtures) {
  if (!item.preAction) return;
  if (item.preAction === "retry-modal") {
    await page.locator('[role="listitem"] button').first().click({ timeout: 15_000 });
    await page.getByTestId("retry-modal-actions").waitFor({ state: "visible", timeout: 15_000 });
    return;
  }
  if (item.preAction === "submission-confirm") {
    await snapshotDraft(item.draftProblemId);
    await page
      .locator("textarea")
      .first()
      .fill(
        `${marker} submission confirmation modal answer. This text is long enough to pass the minimum character threshold for the screenshot.`,
      );
    await page.locator("header button.ant-btn-primary").first().click({ timeout: 15_000 });
    await page.getByTestId("submission-confirm-modal").waitFor({
      state: "visible",
      timeout: 15_000,
    });
    return;
  }
  if (item.preAction === "autosave-warning") {
    await snapshotDraft(item.draftProblemId);
    await page
      .locator("textarea")
      .first()
      .fill(
        `${marker} autosave warning modal answer. This text is intentionally unique so cleanup can identify the temporary draft.`,
      );
    await page.locator("button.ant-btn-link").first().click({ timeout: 15_000 });
    await page.getByTestId("autosave-warning-modal").waitFor({
      state: "visible",
      timeout: 15_000,
    });
    return;
  }
  if (item.preAction === "pdf-export-modal") {
    const input = page.getByTestId("library-search").locator("input");
    await input.fill(fixtures.library.marker);
    await page.getByTestId("library-item-row").first().waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await page.getByTestId("library-select-item").first().click({ timeout: 15_000 });
    await page.getByTestId("library-export-pdf").click({ timeout: 15_000 });
    await page.getByTestId("pdf-export-modal").waitFor({ state: "visible", timeout: 15_000 });
    return;
  }
  throw new Error(`Unknown preAction: ${item.preAction}`);
}

async function captureItem(browser, item, viewport, fixtures) {
  const outDir = prepareEvidenceOutputDirectory({
    cwd,
    slug: evidenceSlug,
    child: path.join(reportChild, "screens", item.folder),
  });
  const baseName = `browser-screenshot--${item.state}--${viewport.name}`;
  const screenshotPath = path.join(outDir, `${baseName}.png`);
  const sidecarPath = path.join(outDir, `${baseName}.json`);
  const contextOptions = {
    baseURL: baseUrl,
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    storageState: item.auth ? authStatePath : { cookies: [], origins: [] },
  };
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const responseErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500) responseErrors.push(`${response.status()} ${response.url()}`);
  });
  const started = Date.now();
  let status = "ok";
  let errorMessage = null;
  try {
    await page.goto(item.route, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(item.route === "/" ? 1200 : 700);
    await runPreAction(page, item, fixtures);
    await page.waitForTimeout(500);
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  } catch (error) {
    status = "failed";
    errorMessage = error?.message || String(error);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
    } catch {}
  }
  const finalUrl = page.url();
  const finalPath = finalUrl ? new URL(finalUrl).pathname : null;
  const expectedPath = new URL(item.route, baseUrl).pathname;
  if (status === "ok" && item.ia === "X-18" && finalPath !== "/auth/consent") {
    status = "redirected";
  }
  if (status === "ok" && item.auth && item.ia !== "X-18" && finalPath === "/login") {
    status = "failed";
    errorMessage = `Authenticated route redirected to /login; expected ${expectedPath}.`;
  }
  const fatalConsoleError = consoleErrors.find((message) =>
    /The above error occurred|TypeError:|ReferenceError:|SyntaxError:|Cannot convert undefined or null/.test(
      message,
    ),
  );
  if (status === "ok" && fatalConsoleError) {
    status = "failed";
    errorMessage = fatalConsoleError.split("\n")[0] || "Fatal console error during capture.";
  }
  const title = await page.title().catch(() => null);
  const headings = await page
    .locator("h1,h2,h3")
    .evaluateAll((nodes) =>
      nodes
        .slice(0, 5)
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    )
    .catch(() => []);
  const sidecar = {
    runId,
    capturedAt: new Date().toISOString(),
    ia: item.ia,
    folder: item.folder,
    state: item.state,
    route: item.route,
    auth: item.auth,
    viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
    status,
    note: item.note ?? null,
    expectedPath,
    finalUrl,
    finalPath,
    title,
    headings,
    screenshotPath: path.relative(cwd, screenshotPath).replaceAll("\\", "/"),
    durationMs: Date.now() - started,
    errors: { pageErrors, consoleErrors, responseErrors, errorMessage },
  };
  await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2));
  await context.close();
  return sidecar;
}

function reportMarkdown(results, cleanupErrors) {
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const failed = results.filter((r) => r.status !== "ok");
  const byScreen = new Map();
  for (const r of results) {
    const key = `${r.ia} ${r.folder} ${r.state}`;
    if (!byScreen.has(key)) byScreen.set(key, []);
    byScreen.get(key).push(r.status);
  }
  const lines = [];
  lines.push("# Full UI State Capture QA Report");
  lines.push("");
  lines.push(`Run ID: ${runId}`);
  lines.push(`Base URL: ${baseUrl}`);
  lines.push(`Started: ${startedAt.toISOString()}`);
  lines.push(`Finished: ${new Date().toISOString()}`);
  lines.push(`Marker: ${marker}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Screens/states: ${byScreen.size}`);
  lines.push(`- Captures: ${results.length}`);
  lines.push(
    `- Status counts: ${Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );
  lines.push(`- Viewports: ${viewports.map((v) => `${v.name} ${v.width}x${v.height}`).join(", ")}`);
  lines.push(`- Fixture cleanup errors: ${cleanupErrors.length}`);
  lines.push("");
  lines.push("## Fixtures");
  lines.push("");
  lines.push(`- Dynamic submissions created for capture: ${cleanup.submissionIds.length}`);
  lines.push(`- Dynamic comparison reports created for capture: ${cleanup.reportIds.length}`);
  lines.push(`- Dynamic recommendation runs created for capture: ${cleanup.runIds.length}`);
  lines.push(`- Dynamic library items created for capture: ${cleanup.libraryItemIds.length}`);
  lines.push("- Fixture rows were cleaned up after capture; screenshots and sidecars are the durable evidence.");
  lines.push("");
  lines.push("## Non-OK Captures");
  lines.push("");
  if (failed.length === 0) lines.push("- None");
  for (const r of failed) {
    lines.push(
      `- ${r.ia} ${r.folder} ${r.state} ${r.viewport.name}: ${r.status}; finalPath=${r.finalPath}; error=${r.errors.errorMessage ?? "n/a"}`,
    );
  }
  lines.push("");
  lines.push("## Output");
  lines.push("");
  lines.push(`- Manifest: ${path.relative(cwd, manifestPath).replaceAll("\\", "/")}`);
  lines.push(
    `- Screenshots: .codex/work/${evidenceSlug}/ui-evidence/full-ui-state-capture-${runId}/screens/<screen-folder>/browser-screenshot--<state>--<viewport>.png`,
  );
  lines.push(
    `- Sidecars: .codex/work/${evidenceSlug}/ui-evidence/full-ui-state-capture-${runId}/screens/<screen-folder>/browser-screenshot--<state>--<viewport>.json`,
  );
  return lines.join("\n");
}

prepareEvidenceOutputDirectory({
  cwd,
  slug: evidenceSlug,
  child: reportChild,
});
emit("start", {
  runId,
  marker,
  reportDir: path.relative(cwd, reportDir).replaceAll("\\", "/"),
});
let results = [];
let cleanupErrors = [];
try {
  emit("fixtures:start");
  const fixtures = {
    short: await createCompletedFeedback(51, "short-feedback"),
    long: await createCompletedFeedback(53, "long-feedback"),
    pending: await createPendingSubmission(),
    comparison: await createComparisonReport(),
    next: await createNextProblemFixture(),
    library: await createLibraryFixture(),
  };
  emit("fixtures:ready", {
    submissions: cleanup.submissionIds.length,
    reports: cleanup.reportIds.length,
    runs: cleanup.runIds.length,
    libraryItems: cleanup.libraryItemIds.length,
  });
  const matrix = await buildMatrix(fixtures);
  await fs.writeFile(
    path.join(reportDir, `state-matrix-${runId}.json`),
    JSON.stringify(
      matrix.map(({ preAction, ...rest }) => ({ ...rest, preAction: preAction ?? null })),
      null,
      2,
    ),
  );
  emit("matrix:ready", { states: matrix.length, captures: matrix.length * viewports.length });
  const browser = await chromium.launch({ headless: true });
  try {
    let completed = 0;
    for (const item of matrix) {
      for (const viewport of viewports) {
        const result = await captureItem(browser, item, viewport, fixtures);
        results.push(result);
        completed += 1;
        emit("capture", {
          completed,
          total: matrix.length * viewports.length,
          ia: item.ia,
          state: item.state,
          viewport: viewport.name,
          status: result.status,
          finalPath: result.finalPath,
        });
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  cleanupErrors = await cleanupFixtures();
  emit("cleanup", { errors: cleanupErrors.length });
}
const manifest = {
  runId,
  marker,
  baseUrl,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  authStatePath: path.relative(cwd, authStatePath).replaceAll("\\", "/"),
  results,
  cleanup: {
    submissionCount: cleanup.submissionIds.length,
    reportCount: cleanup.reportIds.length,
    runCount: cleanup.runIds.length,
    exportCount: cleanup.exportIds.length,
    libraryItemCount: cleanup.libraryItemIds.length,
    draftSnapshotCount: cleanup.draftSnapshots.size,
    errors: cleanupErrors,
  },
};
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
await fs.writeFile(reportPath, reportMarkdown(results, cleanupErrors));
emit("done", {
  runId,
  manifest: path.relative(cwd, manifestPath).replaceAll("\\", "/"),
  report: path.relative(cwd, reportPath).replaceAll("\\", "/"),
  captures: results.length,
  nonOk: results.filter((r) => r.status !== "ok").length,
});
