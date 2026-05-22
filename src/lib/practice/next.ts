// NOTE: This module is server-only by convention — only consumed by RSC /
// server actions / route handlers. We intentionally do not `import "server-only"`
// here because the `server-only` runtime guard is not a runtime dep of this
// project and vitest can't resolve it. Importers must keep the server-only
// boundary themselves (no "use client" file should import from this path).
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type { Tables } from "../supabase/types";

type ClientFactory = () => Promise<SupabaseServerClient>;

/**
 * Phase 6 — "next problem" helper (Task 6 §next).
 *
 * Goal: pick the single next problem the user should solve. Four fallback
 * tiers — each one represents a weaker signal than the previous one. The
 * function returns `null` only when no published problem exists at all
 * (or none the user hasn't already attempted) — the caller's UI shows the
 * "오늘은 자유롭게 골라보세요" CTA in that case.
 *
 * Tier 1: pre-computed `recommendation_items` (status='active', run not
 *         expired) ordered by rank — the strongest signal.
 * Tier 2: same `question_no` as the user's most recent attempt — keeps the
 *         learner inside the dimension they were practicing.
 * Tier 3: any published problem the user hasn't tried — random pick.
 * Tier 4: `null` — let the UI handle the empty state.
 *
 * All queries are RLS-bound (server client, no service role). The caller
 * must already be authenticated.
 */

export type NextProblemSuggestion = {
  problemId: Tables<"problems">["id"];
  title: Tables<"problems">["title"];
  domain: Tables<"problems">["domain"];
  questionNo: Tables<"problems">["question_no"];
  source: "recommendation" | "same_question_no" | "random";
  reason?: string | null;
};

type ProblemSlice = Pick<
  Tables<"problems">,
  "id" | "title" | "domain" | "question_no"
>;

type RecommendationJoinedRow = {
  problem_id: string;
  rank: number;
  reason: string | null;
  recommendation_runs: { expires_at: string | null } | { expires_at: string | null }[] | null;
  problems:
    | (ProblemSlice & { publish_status: string })
    | (ProblemSlice & { publish_status: string })[]
    | null;
};

export async function getNextProblem(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<NextProblemSuggestion | null> {
  const supabase = await createClient();

  // Tier 1 — recommendation_items + recommendation_runs (active, not expired).
  const nowIso = new Date().toISOString();
  const { data: recRows, error: recErr } = await supabase
    .from("recommendation_items")
    .select(
      "problem_id, rank, reason," +
        " recommendation_runs!inner(expires_at)," +
        " problems!inner(id, title, domain, question_no, publish_status)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`, {
      referencedTable: "recommendation_runs",
    })
    .order("rank", { ascending: true })
    .limit(1);
  if (recErr) throw new Error(`getNextProblem(rec): ${recErr.message}`);
  const recRow = (recRows ?? [])[0] as unknown as
    | RecommendationJoinedRow
    | undefined;
  if (recRow) {
    const problem = pickOne(recRow.problems);
    if (problem && problem.publish_status === "published") {
      return {
        problemId: problem.id,
        title: problem.title,
        domain: problem.domain as NextProblemSuggestion["domain"],
        questionNo: problem.question_no,
        source: "recommendation",
        reason: recRow.reason ?? null,
      };
    }
  }

  // Gather attempted problem ids so we never re-suggest something the user
  // already tried (Tiers 2 + 3 both need this).
  const { data: attemptRows, error: attemptErr } = await supabase
    .from("problem_attempts")
    .select("problem_id, started_at, problems!inner(id, question_no)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (attemptErr) {
    throw new Error(`getNextProblem(attempts): ${attemptErr.message}`);
  }

  const attemptedIds = new Set<string>();
  let latestQuestionNo: number | null = null;
  for (const row of attemptRows ?? []) {
    attemptedIds.add(row.problem_id);
    if (latestQuestionNo == null) {
      const joined = pickOne(
        (row as { problems: unknown }).problems as
          | { question_no: number | null }
          | { question_no: number | null }[]
          | null,
      );
      if (joined && typeof joined.question_no === "number") {
        latestQuestionNo = joined.question_no;
      }
    }
  }

  // Tier 2 — next published problem matching the most recent question_no.
  if (latestQuestionNo != null) {
    const tier2 = await pickProblemExcluding(
      supabase,
      attemptedIds,
      latestQuestionNo,
    );
    if (tier2) {
      return {
        problemId: tier2.id,
        title: tier2.title,
        domain: tier2.domain as NextProblemSuggestion["domain"],
        questionNo: tier2.question_no,
        source: "same_question_no",
        reason: null,
      };
    }
  }

  // Tier 3 — any published problem the user hasn't attempted.
  const tier3 = await pickProblemExcluding(supabase, attemptedIds, null);
  if (tier3) {
    return {
      problemId: tier3.id,
      title: tier3.title,
      domain: tier3.domain as NextProblemSuggestion["domain"],
      questionNo: tier3.question_no,
      source: "random",
      reason: null,
    };
  }

  // Tier 4 — nothing left.
  return null;
}

async function pickProblemExcluding(
  supabase: SupabaseServerClient,
  attemptedIds: Set<string>,
  questionNo: number | null,
): Promise<ProblemSlice | null> {
  // Pull a small candidate window then randomly pick one client-side. We
  // avoid `order('random()')` because PostgREST doesn't expose it and a
  // full-table random scan is wasteful. 20 is enough for variety on the
  // weakness page without blowing up the payload.
  //
  // Note: PostgREST filter methods (`.eq`) must precede `.order`/`.limit` —
  // chaining filters after `.limit` returns a non-builder thenable. We apply
  // the optional question_no filter up front for that reason.
  let base = supabase
    .from("problems")
    .select("id, title, domain, question_no")
    .eq("publish_status", "published");
  if (questionNo != null) {
    base = base.eq("question_no", questionNo);
  }
  const { data, error } = await base
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`pickProblemExcluding: ${error.message}`);
  const candidates = (data ?? []).filter((row) => !attemptedIds.has(row.id));
  if (candidates.length === 0) return null;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx] as ProblemSlice;
}

function pickOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}
