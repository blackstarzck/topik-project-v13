#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertLocalPrivilegedMutationTarget } from "./lib/supabase-target-safety.mjs";

const BLANK_KEYS = ["blank_1", "blank_2"];

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const limitArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

if (!Number.isInteger(limit) || limit <= 0) {
  throw new Error("--limit must be a positive integer.");
}

assertLocalPrivilegedMutationTarget(process.env);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: reports, error: reportsError } = await supabase
  .from("comparison_reports")
  .select("id,current_submission_id,previous_submission_id,metrics,narrative")
  .not("previous_submission_id", "is", null)
  .order("generated_at", { ascending: false })
  .limit(limit);

if (reportsError) throw new Error("comparison_backfill_failed: reports_read");

const submissionIds = unique(
  (reports ?? []).flatMap((report) => [
    report.current_submission_id,
    report.previous_submission_id,
  ]),
).filter(Boolean);

const [submissionsResult, feedbackResult] = await Promise.all([
  supabase
    .from("writing_submissions")
    .select("id,question_no,problem_id,char_count,answer_text,submitted_at")
    .in("id", submissionIds),
  supabase
    .from("writing_feedback")
    .select("submission_id,score_total,score_max,raw_ai_result,status")
    .in("submission_id", submissionIds),
]);

if (submissionsResult.error)
  throw new Error("comparison_backfill_failed: submissions_read");
if (feedbackResult.error)
  throw new Error("comparison_backfill_failed: feedback_read");

const submissionsById = new Map(
  (submissionsResult.data ?? []).map((submission) => [submission.id, submission]),
);
const feedbackBySubmissionId = new Map(
  (feedbackResult.data ?? []).map((feedback) => [
    feedback.submission_id,
    feedback,
  ]),
);

const candidates = [];
const skipped = [];

for (const report of reports ?? []) {
  const current = submissionsById.get(report.current_submission_id);
  const previous = report.previous_submission_id
    ? submissionsById.get(report.previous_submission_id)
    : null;
  const currentFeedback = current
    ? feedbackBySubmissionId.get(current.id)
    : null;
  const previousFeedback = previous
    ? feedbackBySubmissionId.get(previous.id)
    : null;

  if (!current || !previous || !currentFeedback || !previousFeedback) {
    skipped.push({ id: report.id, reason: "missing submission or feedback" });
    continue;
  }
  if (![51, 52].includes(current.question_no)) {
    skipped.push({ id: report.id, reason: "not Q51/Q52" });
    continue;
  }
  if (current.problem_id !== previous.problem_id) {
    skipped.push({ id: report.id, reason: "different problem_id" });
    continue;
  }

  const currentItems = readBlankTraitItems(currentFeedback.raw_ai_result);
  const previousItems = readBlankTraitItems(previousFeedback.raw_ai_result);
  if (currentItems.length === 0 && previousItems.length === 0) {
    skipped.push({ id: report.id, reason: "no blank trait_scores" });
    continue;
  }

  const metrics = {
    score_delta: delta(
      normalize(currentFeedback.score_total, currentFeedback.score_max),
      normalize(previousFeedback.score_total, previousFeedback.score_max),
    ),
    dimension_deltas: computeBlankDeltas(currentItems, previousItems),
    char_delta: current.char_count - previous.char_count,
    no_previous: false,
  };
  candidates.push({
    id: report.id,
    current_submission_id: current.id,
    previous_submission_id: previous.id,
    metrics,
    narrative: generateNarrative(metrics),
  });
}

let updated = 0;
if (apply) {
  for (const candidate of candidates) {
    const { error } = await supabase
      .from("comparison_reports")
      .update({
        metrics: candidate.metrics,
        narrative: candidate.narrative,
        ai_model: "comparison-local-v2",
      })
      .eq("id", candidate.id);
    if (error) throw new Error("comparison_backfill_failed: report_update");
    updated += 1;
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      scanned: reports?.length ?? 0,
      candidates: candidates.length,
      updated,
      skipped: skipped.length,
      skippedReasons: countReasons(skipped),
    },
    null,
    2,
  ),
);

function readBlankTraitItems(raw) {
  const traits = raw && typeof raw === "object" ? raw.trait_scores : null;
  if (!Array.isArray(traits)) return [];

  const byKey = new Map();
  for (const trait of traits) {
    if (!trait || typeof trait !== "object") continue;
    const key =
      typeof trait.trait === "string"
        ? trait.trait
        : typeof trait.name === "string"
          ? trait.name
          : null;
    if (!BLANK_KEYS.includes(key)) continue;
    const score = finiteNumber(trait.score);
    const scoreMax = positiveNumber(trait.max_score);
    byKey.set(key, {
      key,
      score: normalize(score, scoreMax),
      rawScore: score,
      scoreMax,
    });
  }

  return BLANK_KEYS.flatMap((key) => {
    const item = byKey.get(key);
    return item ? [item] : [];
  });
}

function computeBlankDeltas(currentItems, previousItems) {
  const previousByKey = new Map(previousItems.map((item) => [item.key, item]));
  return Object.fromEntries(
    currentItems.map((current) => {
      const previous = previousByKey.get(current.key);
      return [current.key, delta(current.score, previous?.score ?? null)];
    }),
  );
}

function delta(current, previous) {
  if (current === null || previous === null) return null;
  return round1(current - previous);
}

function normalize(score, scoreMax) {
  if (score === null) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return round1((score / max) * 100);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function generateNarrative(metrics) {
  const total =
    metrics.score_delta === null
      ? "총점 비교가 어려운 항목입니다."
      : metrics.score_delta >= 0
        ? `이번 답안의 총점이 ${formatPoint(metrics.score_delta)}점 향상되었습니다.`
        : `이번 답안의 총점이 ${formatPoint(Math.abs(metrics.score_delta))}점 하락했습니다.`;
  const blanks = Object.entries(metrics.dimension_deltas)
    .filter((entry) => entry[1] !== null && Math.abs(entry[1]) >= 2)
    .slice(0, 2)
      .map(
        ([key, value]) =>
        `${key === "blank_1" ? "ㄱ 빈칸" : "ㄴ 빈칸"} ${value >= 0 ? "+" : ""}${formatPoint(value)}점`,
      )
    .join(", ");
  return blanks ? `${total} 주요 변화: ${blanks}.` : total;
}

function formatPoint(value) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function unique(values) {
  return [...new Set(values)];
}

function countReasons(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value.reason, (counts.get(value.reason) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
