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
import { getCanonicalWritingProblems } from "../writing/canonical-source";

type ClientFactory = () => Promise<SupabaseServerClient>;

/**
 * Phase 6 — "next problem" helper (Task 6 §next).
 *
 * Goal: pick the next-problem bundle the user can choose from. The primary
 * slot still needs a single problem, but the R-02 screen fills alternatives
 * from the same 51/52/53/54 writing set instead of limiting new users to one
 * question type. Four fallback tiers — each one represents a weaker signal than the previous one. The
 * function returns `null` only when no published problem exists at all
 * (or none the user hasn't already attempted) — the caller's UI shows the
 * "오늘은 자유롭게 골라보세요" CTA in that case.
 *
 * Tier 1: pre-computed `recommendation_items` (status='active', run not
 *         expired) ordered by rank — the strongest signal.
 * Tier 2: same `question_no` as the user's most recent attempt — keeps the
 *         learner inside the dimension they were practicing.
 * Tier 3: any published problem the user hasn't tried — 51/52/53/54 writing set.
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

const WRITING_QUESTION_NOS = [51, 52, 53, 54] as const;
const RECOMMENDATION_SCAN_PAGE_SIZE = 8;
const MAX_VISIBILITY_SCAN_ROWS = 200;
const PRIMARY_VISIBLE_TARGET = 25;
const ALTERNATIVE_VISIBLE_TARGET = 12;

type RecommendationJoinedRow = {
  id: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  estimated_minutes: number | null;
  recommendation_runs:
    | { expires_at: string | null }
    | { expires_at: string | null }[]
    | null;
  problems:
    | (ProblemSlice & { publish_status: string; difficulty: number | null })
    | (ProblemSlice & { publish_status: string; difficulty: number | null })[]
    | null;
};

type AttemptRow = {
  problem_id: string;
  started_at: string | null;
  problems?:
    | { question_no: number | null }
    | { question_no: number | null }[]
    | null;
};

export async function getNextProblem(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<NextProblemSuggestion | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  return getNextProblemForMode(supabase, userId, nowIso);
}

async function getNextProblemForMode(
  supabase: SupabaseServerClient,
  userId: string,
  nowIso: string,
): Promise<NextProblemSuggestion | null> {
  // Tier 1 — recommendation_items + recommendation_runs (active, not expired).
  const [visibleRecRow] = await fetchVisibleRecommendationRows(
    supabase,
    userId,
    nowIso,
    1,
    null,
    "getNextProblem(rec)",
  );
  if (visibleRecRow) {
    const problem = pickOne(visibleRecRow.problems);
    if (problem) {
      return {
        problemId: problem.id,
        title: problem.title,
        domain: problem.domain as NextProblemSuggestion["domain"],
        questionNo: problem.question_no,
        source: "recommendation",
        reason: visibleRecRow.reason ?? null,
        // Use `undefined` (not null) when the underlying field is absent so
        // callers that don't need these keys (and `toEqual` in unit tests)
        // ignore them. Real data still flows through unchanged.
        difficulty: problem.difficulty ?? undefined,
        estimatedMinutes: visibleRecRow.estimated_minutes ?? undefined,
        itemId: visibleRecRow.id ?? undefined,
      };
    }
  }

  // Gather attempted problem ids so we never re-suggest something the user
  // already tried (Tiers 2 + 3 both need this).
  const attemptResult = await supabase
    .from("problem_attempts")
    .select("problem_id, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  const attemptErr = attemptResult.error;
  if (attemptErr) {
    throw new Error(`getNextProblem(attempts): ${attemptErr.message}`);
  }
  const attemptRows = (attemptResult.data ?? []) as unknown as AttemptRow[];

  const attemptedIds = new Set<string>();
  let latestQuestionNo: number | null = null;
  const canonicalQuestionNoById = new Map(
    (await getCanonicalWritingProblems({ supabase })).map((problem) => [
      problem.id,
      problem.questionNo,
    ]),
  );
  for (const row of attemptRows ?? []) {
    attemptedIds.add(row.problem_id);
    if (latestQuestionNo == null) {
      latestQuestionNo = canonicalQuestionNoById.get(row.problem_id) ?? null;
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

  // Tier 3 — any published problem the user hasn't attempted. The source name
  // stays "random" for compatibility with existing UI labels, but selection is
  // deterministic so the bundle can expose the full 51/52/53/54 writing set.
  const tier3 = await pickProblemExcluding(
    supabase,
    attemptedIds,
    null,
    latestQuestionNo,
  );
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
  rotationAnchorQuestionNo: number | null = questionNo,
): Promise<ProblemSlice | null> {
  // Pull a small candidate window then choose by the 51→52→53→54 practice
  // rotation. We avoid `order('random()')` because PostgREST doesn't expose it
  // and random selection makes first-user recommendations unstable.
  //
  // Note: PostgREST filter methods (`.eq`) must precede `.order`/`.limit` —
  // chaining filters after `.limit` returns a non-builder thenable. We apply
  // the optional question_no filter up front for that reason.
  const candidates = await fetchVisiblePublishedWritingProblems(supabase, {
    attemptedIds,
    excludedIds: new Set(),
    questionNo,
    targetCount: PRIMARY_VISIBLE_TARGET,
  });
  return pickByQuestionRotation(candidates, rotationAnchorQuestionNo);
}

async function fetchVisibleRecommendationRows(
  supabase: SupabaseServerClient,
  userId: string,
  nowIso: string,
  targetCount: number,
  excludeId: string | null,
  errorContext: string,
): Promise<RecommendationJoinedRow[]> {
  const canonicalProblems = await getCanonicalWritingProblems({ supabase });
  const canonicalById = new Map(
    canonicalProblems.map((problem) => [problem.id, problem]),
  );
  const rows: RecommendationJoinedRow[] = [];

  for (
    let offset = 0;
    offset < MAX_VISIBILITY_SCAN_ROWS && rows.length < targetCount;
    offset += RECOMMENDATION_SCAN_PAGE_SIZE
  ) {
    const { data, error } = await supabase
      .from("recommendation_items")
      .select(
        "id, problem_id, rank, reason, estimated_minutes," +
          " recommendation_runs!inner(expires_at)",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`, {
        referencedTable: "recommendation_runs",
      })
      .order("rank", { ascending: true })
      .range(offset, offset + RECOMMENDATION_SCAN_PAGE_SIZE - 1);
    if (error) throw new Error(`${errorContext}: ${error.message}`);

    const page = (data ?? []) as unknown as Array<
      Omit<RecommendationJoinedRow, "problems">
    >;
    for (const row of page) {
      const canonical = canonicalById.get(row.problem_id);
      if (!canonical || canonical.id === excludeId) continue;
      rows.push({
        ...row,
        problems: {
          id: canonical.id,
          title: canonical.title,
          domain: "writing",
          question_no: canonical.questionNo,
          difficulty: canonical.difficulty ?? null,
          publish_status: "published",
        },
      });
      if (rows.length >= targetCount) break;
    }
    if (page.length < RECOMMENDATION_SCAN_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchVisiblePublishedWritingProblems(
  supabase: SupabaseServerClient,
  options: {
    attemptedIds: Set<string>;
    excludedIds: Set<string>;
    questionNo: number | null;
    targetCount: number;
  },
): Promise<ProblemSlice[]> {
  const canonical = await getCanonicalWritingProblems({
    supabase,
    questionNo: isWritingQuestionNo(options.questionNo)
      ? options.questionNo
      : null,
  });
  return canonical
    .filter(
      (problem) =>
        !options.excludedIds.has(problem.id) &&
        !options.attemptedIds.has(problem.id),
    )
    .slice(0, options.targetCount)
    .map((problem) => ({
      id: problem.id,
      title: problem.title,
      domain: "writing",
      question_no: problem.questionNo,
      difficulty: problem.difficulty ?? null,
    }));
}

function pickOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

export function isWritingQuestionNo(
  questionNo: number | null | undefined,
): questionNo is (typeof WRITING_QUESTION_NOS)[number] {
  return WRITING_QUESTION_NOS.includes(
    questionNo as (typeof WRITING_QUESTION_NOS)[number],
  );
}

export function questionRotationOrder(
  latestQuestionNo: number | null | undefined,
): readonly number[] {
  if (!isWritingQuestionNo(latestQuestionNo)) return WRITING_QUESTION_NOS;
  const index = WRITING_QUESTION_NOS.indexOf(latestQuestionNo);
  return [
    ...WRITING_QUESTION_NOS.slice(index + 1),
    ...WRITING_QUESTION_NOS.slice(0, index + 1),
  ];
}

function pickByQuestionRotation(
  candidates: ProblemSlice[],
  latestQuestionNo: number | null | undefined,
): ProblemSlice | null {
  if (candidates.length === 0) return null;
  return sortByQuestionRotation(candidates, latestQuestionNo)[0];
}

function sortByQuestionRotation(
  candidates: ProblemSlice[],
  latestQuestionNo: number | null | undefined,
): ProblemSlice[] {
  const order = questionRotationOrder(latestQuestionNo);
  return [...candidates].sort((a, b) => {
    const orderDelta =
      order.indexOf(a.question_no ?? -1) - order.indexOf(b.question_no ?? -1);
    if (orderDelta !== 0) return orderDelta;
    const difficultyDelta = (a.difficulty ?? 999) - (b.difficulty ?? 999);
    if (difficultyDelta !== 0) return difficultyDelta;
    return a.title.localeCompare(b.title, "ko");
  });
}

// Phase 7-D Task 6 (P1-2) — getNextProblemBundle.
// docs/prd.md의 다음 문제 추천 흐름과 practice tests가 요구하는 계약:
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
  nowIso: string,
): Promise<AlternativeProblem[]> {
  // Pull next 3 active recommendations (rank 2-4) excluding primary id
  const altRows = await fetchVisibleRecommendationRows(
    supabase,
    userId,
    nowIso,
    3,
    excludeId,
    "fetchAlternatives(recommendations)",
  );
  const alternatives: AlternativeProblem[] = altRows
    .flatMap((row) => {
      const p = pickOne(row.problems);
      if (!p || typeof p !== "object") return [];
      const problem = p as ProblemSlice & { publish_status?: string | null };
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

  if (alternatives.length < 3) {
    const excludedIds = new Set(alternatives.map((alt) => alt.id));
    if (excludeId) excludedIds.add(excludeId);
    const fallbackAlternatives = await fetchPublishedProblemAlternatives(
      supabase,
      userId,
      excludedIds,
      3 - alternatives.length,
    );
    alternatives.push(...fallbackAlternatives);
  }

  // R-02 §3 예외 — free-plan users keep the first alternative unlocked and see
  // the rest as locked upgrade cards. Paid users see everything unlocked.
  if (paid) return alternatives;
  return alternatives.map((alt, idx) =>
    idx === 0 ? alt : { ...alt, locked: true },
  );
}

async function fetchPublishedProblemAlternatives(
  supabase: SupabaseServerClient,
  userId: string,
  excludedIds: Set<string>,
  limit: number,
): Promise<AlternativeProblem[]> {
  const attemptResult = await supabase
    .from("problem_attempts")
    .select("problem_id, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (attemptResult.error) throw attemptResult.error;
  const attemptRows = (attemptResult.data ?? []) as unknown as AttemptRow[];

  const attemptedIds = new Set<string>();
  let latestQuestionNo: number | null = null;
  const canonicalQuestionNoById = new Map(
    (await getCanonicalWritingProblems({ supabase })).map((problem) => [
      problem.id,
      problem.questionNo,
    ]),
  );
  for (const row of attemptRows ?? []) {
    attemptedIds.add(row.problem_id);
    if (latestQuestionNo == null) {
      latestQuestionNo = canonicalQuestionNoById.get(row.problem_id) ?? null;
    }
  }

  const candidates = await fetchVisiblePublishedWritingProblems(supabase, {
    attemptedIds,
    excludedIds,
    questionNo: null,
    targetCount: Math.max(limit, ALTERNATIVE_VISIBLE_TARGET),
  });

  return sortByQuestionRotation(candidates, latestQuestionNo)
    .slice(0, limit)
    .map((problem) => ({
      id: problem.id,
      title: problem.title,
      questionNo: problem.question_no,
      domain: problem.domain,
      reason: "아직 풀지 않은 공개 문제입니다.",
      estimatedMinutes: null,
      difficulty: problem.difficulty ?? null,
    }));
}

export async function getNextProblemBundle(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<NextProblemBundle> {
  const supabase = await createClient();
  const summary = await fetchSummarySignals(supabase, userId);

  // Plan gate for the locked alternative variant (R-02 §3 예외).
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_label")
    .eq("id", userId)
    .maybeSingle();
  const paid = isPaidPlan(profile?.plan_label);
  const nowIso = new Date().toISOString();

  const canonical = await getNextProblemBundleContentForMode(
    supabase,
    userId,
    paid,
    nowIso,
  );
  return { ...canonical, summary };
}

type NextProblemBundleContent = Omit<NextProblemBundle, "summary">;

async function getNextProblemBundleContentForMode(
  supabase: SupabaseServerClient,
  userId: string,
  paid: boolean,
  nowIso: string,
): Promise<NextProblemBundleContent> {
  const primary = await getNextProblemForMode(supabase, userId, nowIso);
  const alternatives = await fetchAlternatives(
    supabase,
    userId,
    primary?.problemId ?? null,
    paid,
    nowIso,
  );
  return {
    primary,
    primaryTier: nextProblemTier(primary),
    alternatives,
  };
}

function nextProblemTier(
  problem: NextProblemSuggestion | null,
): NextProblemBundle["primaryTier"] {
  if (!problem) return 4;
  if (problem.source === "recommendation") return 1;
  if (problem.source === "same_question_no") return 2;
  return 3;
}
