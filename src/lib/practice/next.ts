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
  /**
   * Phase 7-D follow-up (R-02 §2) — 난이도/시간 배지(필수) for the recommended
   * highlight. `difficulty` from `problems.difficulty`; `estimatedMinutes`
   * from `recommendation_items.estimated_minutes` (only present when the
   * suggestion came from a real recommendation row). Both optional/null for
   * the fallback tiers that have no backing recommendation item.
   */
  difficulty?: number | null;
  estimatedMinutes?: number | null;
  /**
   * recommendation_items.id when source === "recommendation". The view uses
   * this to flip the row to status='consumed' on start (RLS owner-update).
   * null for fallback tiers (same_question_no / random) — nothing to consume.
   */
  itemId?: string | null;
};

type ProblemSlice = Pick<
  Tables<"problems">,
  "id" | "title" | "domain" | "question_no" | "difficulty"
>;

type RecommendationJoinedRow = {
  id: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  estimated_minutes: number | null;
  recommendation_runs: { expires_at: string | null } | { expires_at: string | null }[] | null;
  problems:
    | (ProblemSlice & { publish_status: string; difficulty: number | null })
    | (ProblemSlice & { publish_status: string; difficulty: number | null })[]
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
      "id, problem_id, rank, reason, estimated_minutes," +
        " recommendation_runs!inner(expires_at)," +
        " problems!inner(id, title, domain, question_no, difficulty, publish_status)",
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
        // Use `undefined` (not null) when the underlying field is absent so
        // callers that don't need these keys (and `toEqual` in unit tests)
        // ignore them. Real data still flows through unchanged.
        difficulty: problem.difficulty ?? undefined,
        estimatedMinutes: recRow.estimated_minutes ?? undefined,
        itemId: recRow.id ?? undefined,
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
        difficulty: tier2.difficulty ?? undefined,
        estimatedMinutes: undefined,
        itemId: undefined,
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
      difficulty: tier3.difficulty ?? undefined,
      estimatedMinutes: undefined,
      itemId: undefined,
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
    .select("id, title, domain, question_no, difficulty")
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

// Phase 7-D Task 6 (P1-2) — getNextProblemBundle.
// IA spec (docs/Wireframe/17-R-02-next-problem-recommendation/description.md) requires:
//   - primary (existing getNextProblem result)
//   - summary (recent submissions count + average score + weakest dimensions)
//   - alternatives (3 problems user can pick instead)
//
// Tier 2 OOS-1 (real LLM) not required; signals come from existing tables
// (writing_submissions, writing_feedback, feedback_dimension_scores,
// recommendation_items, problems).

export type SummarySignals = {
  recentSubmissions: number;
  averageScore: number | null;
  weakestDimensions: { dimension: string; score: number }[];
};

export type AlternativeProblem = {
  id: string;
  title: string;
  questionNo: number | null;
  domain: string;
  reason: string | null;
  /** recommendation_items.id (when from a real rec row) — for consume on start. */
  itemId?: string | null;
  estimatedMinutes?: number | null;
  difficulty?: number | null;
  /**
   * Phase 7-D follow-up (R-02 §3 예외) — 권한 잠금 카드. Free-plan users see
   * the first alternative unlocked and the rest locked with an upgrade prompt.
   * Locked cards are non-interactive (no navigation, no consume).
   */
  locked?: boolean;
};

export type NextProblemBundle = {
  primary: NextProblemSuggestion | null;
  primaryTier: 1 | 2 | 3 | 4;
  summary: SummarySignals;
  alternatives: AlternativeProblem[];
};

/** 유료에 해당하는 plan_label (weakness 페이지와 동일 기준). */
const PAID_PLAN_LABELS = new Set([
  "premium",
  "pro",
  "team",
  "yearly",
  "quarterly",
  "monthly",
]);

function isPaidPlan(planLabel: string | null | undefined): boolean {
  if (!planLabel) return false;
  return PAID_PLAN_LABELS.has(planLabel.toLowerCase());
}

async function fetchSummarySignals(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SummarySignals> {
  // Recent submissions count (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("writing_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("submitted_at", since);

  // Average score
  const { data: feedbacks } = await supabase
    .from("writing_feedback")
    .select("score_total")
    .eq("user_id", userId)
    .not("score_total", "is", null)
    .order("generated_at", { ascending: false })
    .limit(20);
  const scores = (feedbacks ?? [])
    .map((r) => r.score_total)
    .filter((s): s is number => typeof s === "number");
  const averageScore =
    scores.length === 0
      ? null
      : scores.reduce((a, b) => a + b, 0) / scores.length;

  // Weakest dimensions — average score per dimension across recent feedbacks,
  // pick lowest 3
  const { data: dims } = await supabase
    .from("feedback_dimension_scores")
    .select("dimension, score")
    .eq("user_id", userId)
    .not("score", "is", null);
  const dimBuckets = new Map<string, number[]>();
  for (const d of dims ?? []) {
    if (typeof d.score !== "number") continue;
    const arr = dimBuckets.get(d.dimension) ?? [];
    arr.push(d.score);
    dimBuckets.set(d.dimension, arr);
  }
  const dimAverages = Array.from(dimBuckets.entries()).map(([dim, arr]) => ({
    dimension: dim,
    score: arr.reduce((a, b) => a + b, 0) / arr.length,
  }));
  dimAverages.sort((a, b) => a.score - b.score);
  const weakestDimensions = dimAverages.slice(0, 3);

  return {
    recentSubmissions: count ?? 0,
    averageScore,
    weakestDimensions,
  };
}

async function fetchAlternatives(
  supabase: SupabaseServerClient,
  userId: string,
  excludeId: string | null,
  paid: boolean,
): Promise<AlternativeProblem[]> {
  // Pull next 3 active recommendations (rank 2-4) excluding primary id
  const { data } = await supabase
    .from("recommendation_items")
    .select(
      "id, problem_id, reason, estimated_minutes," +
        " problems!inner(id, title, domain, question_no, difficulty)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("rank", { ascending: true })
    .limit(4);

  type AltRow = {
    id: string;
    reason: string | null;
    estimated_minutes: number | null;
    problems: unknown;
  };
  const altRows = (data ?? []) as unknown as AltRow[];
  const alternatives = altRows
    .flatMap((row) => {
      const p = pickOne(row.problems);
      if (!p || typeof p !== "object") return [];
      const problem = p as ProblemSlice;
      if (problem.id === excludeId) return [];
      return [
        {
          id: problem.id,
          title: problem.title,
          questionNo: problem.question_no,
          domain: problem.domain,
          reason: row.reason ?? null,
          itemId: row.id ?? null,
          estimatedMinutes: row.estimated_minutes ?? null,
          difficulty: problem.difficulty ?? null,
        } satisfies AlternativeProblem,
      ];
    })
    .slice(0, 3);

  // R-02 §3 예외 — free-plan users keep the first alternative unlocked and see
  // the rest as locked upgrade cards. Paid users see everything unlocked.
  if (paid) return alternatives;
  return alternatives.map((alt, idx) =>
    idx === 0 ? alt : { ...alt, locked: true },
  );
}

export async function getNextProblemBundle(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<NextProblemBundle> {
  const supabase = await createClient();
  const next = await getNextProblem(userId, () => Promise.resolve(supabase));
  const summary = await fetchSummarySignals(supabase, userId);

  // Plan gate for the locked alternative variant (R-02 §3 예외).
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_label")
    .eq("id", userId)
    .maybeSingle();
  const paid = isPaidPlan(profile?.plan_label);

  const alternatives = await fetchAlternatives(
    supabase,
    userId,
    next?.problemId ?? null,
    paid,
  );
  // primaryTier derived from next.source
  const primaryTier: NextProblemBundle["primaryTier"] = !next
    ? 4
    : next.source === "recommendation"
      ? 1
      : next.source === "same_question_no"
        ? 2
        : 3;
  return {
    primary: next,
    primaryTier,
    summary,
    alternatives,
  };
}
