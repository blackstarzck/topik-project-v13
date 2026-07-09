// NOTE: This module is server-only by convention — only consumed by RSC /
// server actions / route handlers. We intentionally do not `import "server-only"`
// here because the `server-only` runtime guard is not a runtime dep of this
// project and vitest can't resolve it. Importers must keep the server-only
// boundary themselves (no "use client" file should import from this path).
import { getLearningGoal } from "../learning/server";
import { filterVisibleProblemIds } from "../problems/visibility";
import type { SupabaseServerClient } from "../supabase/server";
import type { Tables } from "../supabase/types";
import { isWritingQuestionNo, questionRotationOrder } from "./next";
import type { RecommendationItemCard } from "./recommendations";
import { QUESTION_NOS, type QuestionNo } from "./types";
import { getWeakDimensions, type WeakDimensionSummary } from "./weakness";

/**
 * C-01 rule-based transient recommendations (implementation brief:
 * docs/sot-change-proposals/2026-07-09-c01-rule-fallback-recommendations-implementation-brief.md).
 *
 * Runs ONLY when the user has zero stored recommendation_items. Candidates
 * are scored with fixed rule weights over the user's own signals (attempt
 * history, weak feedback dimensions, learning goal) — no AI, no persistence.
 * Every item maps to a real published+visible problem; `itemId` stays null
 * because there is no recommendation row to consume.
 */

export const FALLBACK_ITEM_TARGET = 4;

export const RECOMMENDATION_REASON_CODES = [
  "TYPE_ROTATION_NEXT",
  "RECENT_TYPE_CONTINUATION",
  "WEAK_AREA_TAG_MATCH",
  "GOAL_DIFFICULTY_MATCH",
  "UNATTEMPTED_AVAILABLE",
] as const;

export type RecommendationReasonCode =
  (typeof RECOMMENDATION_REASON_CODES)[number];

/**
 * Which honest run-level summary the UI should show for a computed bundle:
 * "history" when personal signals (attempts / weak dimensions) actually
 * influenced the scores, "rotation" when the pick is pure 51→54 rotation.
 */
export type ComputedSummaryCode = "history" | "rotation";

export type FallbackSignals = {
  attemptedIds: Set<string>;
  latestQuestionNo: QuestionNo | null;
  weakDimensions: WeakDimensionSummary[];
  goal: Pick<Tables<"learning_goals">, "topik_level" | "target_grade"> | null;
};

export type FallbackCandidate = {
  id: string;
  title: string;
  questionNo: QuestionNo;
  topikLevel: number | null;
  difficulty: number | null;
  tags: string[];
};

export type RankedFallbackCandidate = {
  candidate: FallbackCandidate;
  score: number;
  reasonCode: RecommendationReasonCode;
  /** Weak dimensions that actually overlap this problem's tags — never padded. */
  weaknessTags: string[];
};

export type ComputedRecommendations = {
  items: RecommendationItemCard[];
  availableTypes: QuestionNo[];
  summaryCode: ComputedSummaryCode | null;
};

// Score table — docs/todo/codex-recommendation-logic-design.html §6.4 subset.
// Signals the design lists but this app cannot observe (avoid_repeat_keys,
// spaced-review, same-type over-repetition) are intentionally absent; see the
// implementation brief's out-of-scope section.
const SCORE_ROTATION_NEXT = 20;
const SCORE_RECENT_CONTINUATION = 15;
const SCORE_WEAK_TAG_PER_DIMENSION = 8;
const SCORE_WEAK_TAG_CAP = 16;
const SCORE_GOAL_LEVEL_MATCH = 6;
const SCORE_GOAL_DIFFICULTY_NEAR = 9;
const PENALTY_DIFFICULTY_JUMP = -10;

/** learning_goals.target_grade (1..6) → comfortable problems.difficulty. */
const GOAL_TARGET_DIFFICULTY: Record<number, number> = {
  1: 2,
  2: 3,
  3: 3,
  4: 4,
  5: 4,
  6: 5,
};

const CANDIDATE_PAGE_SIZE = 40;
const CANDIDATE_MAX_PAGES_PER_TYPE = 2;
/** Rows kept per type BEFORE the visibility RPC (headroom for filtering). */
const CANDIDATE_PREVISIBILITY_TARGET = 12;
/** Visible candidates kept per type for scoring. */
const CANDIDATES_PER_TYPE = 6;

export async function computeFallbackRecommendations(
  supabase: SupabaseServerClient,
  userId: string,
  questionNo: QuestionNo | null,
): Promise<ComputedRecommendations> {
  const signals = await collectSignals(supabase, userId);
  const candidates = await collectCandidates(
    supabase,
    signals.attemptedIds,
    questionNo,
  );
  const ranked = rankFallbackCandidates(candidates, signals, questionNo);

  const items: RecommendationItemCard[] = ranked.map((entry, index) => ({
    itemId: null,
    problemId: entry.candidate.id,
    rank: index + 1,
    reason: null,
    reasonCode: entry.reasonCode,
    estimatedMinutes: null,
    weaknessTags: entry.weaknessTags,
    title: entry.candidate.title,
    questionNo: entry.candidate.questionNo,
  }));

  const typeSet = new Set(ranked.map((entry) => entry.candidate.questionNo));
  const availableTypes = QUESTION_NOS.filter((qn) => typeSet.has(qn));
  const summaryCode: ComputedSummaryCode | null =
    items.length === 0
      ? null
      : signals.attemptedIds.size > 0 || signals.weakDimensions.length > 0
        ? "history"
        : "rotation";

  return { items, availableTypes, summaryCode };
}

/**
 * Pure scoring + ordering — exported for deterministic unit tests. Uses no
 * clock and no randomness; ties fall through rotation order → difficulty →
 * ko-locale title → id so identical inputs always produce identical output.
 */
export function rankFallbackCandidates(
  candidates: FallbackCandidate[],
  signals: FallbackSignals,
  questionNo: QuestionNo | null,
): RankedFallbackCandidate[] {
  const rotation = questionRotationOrder(signals.latestQuestionNo);
  const scored = candidates
    .filter((c) => questionNo == null || c.questionNo === questionNo)
    .map((c) => scoreCandidate(c, signals, rotation))
    .sort((a, b) => compareRanked(a, b, rotation));

  if (questionNo != null) return scored.slice(0, FALLBACK_ITEM_TARGET);

  // Diversity re-rank: one best candidate per question type in rotation
  // order (so the primary sits on the rotation-next type), then fill any
  // remaining slots by global score.
  const picked: RankedFallbackCandidate[] = [];
  const pickedIds = new Set<string>();
  for (const qn of rotation) {
    if (picked.length >= FALLBACK_ITEM_TARGET) break;
    const best = scored.find(
      (entry) =>
        entry.candidate.questionNo === qn && !pickedIds.has(entry.candidate.id),
    );
    if (best) {
      picked.push(best);
      pickedIds.add(best.candidate.id);
    }
  }
  for (const entry of scored) {
    if (picked.length >= FALLBACK_ITEM_TARGET) break;
    if (pickedIds.has(entry.candidate.id)) continue;
    picked.push(entry);
    pickedIds.add(entry.candidate.id);
  }
  return picked;
}

function scoreCandidate(
  candidate: FallbackCandidate,
  signals: FallbackSignals,
  rotation: readonly number[],
): RankedFallbackCandidate {
  let score = 0;
  // Components in score-table order; reasonCode = the strongest one, ties
  // resolved by that same order (stable `>` comparison).
  const components: Array<{ code: RecommendationReasonCode; points: number }> =
    [];

  if (candidate.questionNo === rotation[0]) {
    score += SCORE_ROTATION_NEXT;
    components.push({ code: "TYPE_ROTATION_NEXT", points: SCORE_ROTATION_NEXT });
  }
  if (
    signals.latestQuestionNo != null &&
    candidate.questionNo === signals.latestQuestionNo
  ) {
    score += SCORE_RECENT_CONTINUATION;
    components.push({
      code: "RECENT_TYPE_CONTINUATION",
      points: SCORE_RECENT_CONTINUATION,
    });
  }

  const weaknessTags = signals.weakDimensions
    .map((weak) => weak.dimension)
    .filter((dimension) => candidate.tags.includes(dimension));
  if (weaknessTags.length > 0) {
    const points = Math.min(
      weaknessTags.length * SCORE_WEAK_TAG_PER_DIMENSION,
      SCORE_WEAK_TAG_CAP,
    );
    score += points;
    components.push({ code: "WEAK_AREA_TAG_MATCH", points });
  }

  if (signals.goal) {
    let goalPoints = 0;
    const goalLevel = signals.goal.topik_level === "TOPIK_I" ? 1 : 2;
    if (candidate.topikLevel === goalLevel) {
      goalPoints += SCORE_GOAL_LEVEL_MATCH;
    }
    const target = GOAL_TARGET_DIFFICULTY[signals.goal.target_grade];
    if (target != null && candidate.difficulty != null) {
      if (Math.abs(candidate.difficulty - target) <= 1) {
        goalPoints += SCORE_GOAL_DIFFICULTY_NEAR;
      }
      if (candidate.difficulty - target >= 2) {
        score += PENALTY_DIFFICULTY_JUMP;
      }
    }
    if (goalPoints > 0) {
      score += goalPoints;
      components.push({ code: "GOAL_DIFFICULTY_MATCH", points: goalPoints });
    }
  }

  let reasonCode: RecommendationReasonCode = "UNATTEMPTED_AVAILABLE";
  let bestPoints = 0;
  for (const component of components) {
    if (component.points > bestPoints) {
      bestPoints = component.points;
      reasonCode = component.code;
    }
  }

  return { candidate, score, reasonCode, weaknessTags };
}

function compareRanked(
  a: RankedFallbackCandidate,
  b: RankedFallbackCandidate,
  rotation: readonly number[],
): number {
  if (b.score !== a.score) return b.score - a.score;
  const rotationDelta =
    rotation.indexOf(a.candidate.questionNo) -
    rotation.indexOf(b.candidate.questionNo);
  if (rotationDelta !== 0) return rotationDelta;
  const difficultyDelta =
    (a.candidate.difficulty ?? 999) - (b.candidate.difficulty ?? 999);
  if (difficultyDelta !== 0) return difficultyDelta;
  const titleDelta = a.candidate.title.localeCompare(b.candidate.title, "ko");
  if (titleDelta !== 0) return titleDelta;
  return a.candidate.id.localeCompare(b.candidate.id);
}

async function collectSignals(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<FallbackSignals> {
  // Attempt history is the core signal — its failure surfaces as a 500 (the
  // screen has an error+retry state). Weak dimensions and the learning goal
  // only tune scores, so their failures degrade to neutral instead of
  // breaking the screen.
  const [attempts, weakDimensions, goal] = await Promise.all([
    fetchAttemptSignals(supabase, userId),
    getWeakDimensions(userId, 5, async () => supabase).catch(
      () => [] as WeakDimensionSummary[],
    ),
    getLearningGoal(userId, async () => supabase).catch(() => null),
  ]);
  return {
    ...attempts,
    weakDimensions,
    goal: goal
      ? { topik_level: goal.topik_level, target_grade: goal.target_grade }
      : null,
  };
}

async function fetchAttemptSignals(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Pick<FallbackSignals, "attemptedIds" | "latestQuestionNo">> {
  const { data, error } = await supabase
    .from("problem_attempts")
    .select("problem_id, started_at, problems!inner(id, question_no)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (error) {
    throw new Error(`computeFallbackRecommendations(attempts): ${error.message}`);
  }

  const attemptedIds = new Set<string>();
  let latestQuestionNo: QuestionNo | null = null;
  for (const row of data ?? []) {
    attemptedIds.add(row.problem_id);
    if (latestQuestionNo == null) {
      const joined = pickOne(
        (row as { problems: unknown }).problems as
          | { question_no: number | null }
          | { question_no: number | null }[]
          | null,
      );
      if (joined && isWritingQuestionNo(joined.question_no)) {
        latestQuestionNo = joined.question_no;
      }
    }
  }
  return { attemptedIds, latestQuestionNo };
}

type CandidateRow = {
  id: string;
  title: string;
  question_no: number | null;
  topik_level: number | null;
  difficulty: number | null;
  tags: string[] | null;
  materials: unknown;
};

type CandidateQueryResult = {
  data: CandidateRow[] | null;
  error: { message: string } | null;
};

async function collectCandidates(
  supabase: SupabaseServerClient,
  attemptedIds: Set<string>,
  questionNo: QuestionNo | null,
): Promise<FallbackCandidate[]> {
  // Per-type queries instead of one updated_at scan: a recent batch of
  // problems in a single type would otherwise crowd out the other types and
  // break the diversity re-rank.
  const targetTypes = questionNo != null ? [questionNo] : [...QUESTION_NOS];
  const byType: Array<[QuestionNo, FallbackCandidate[]]> = [];
  for (const qn of targetTypes) {
    byType.push([qn, await fetchTypeCandidates(supabase, qn, attemptedIds)]);
  }

  const allIds = byType.flatMap(([, rows]) => rows.map((row) => row.id));
  const visibleIds = await filterVisibleProblemIds(supabase, allIds);

  const result: FallbackCandidate[] = [];
  for (const [, rows] of byType) {
    result.push(
      ...rows
        .filter((row) => visibleIds.has(row.id))
        .slice(0, CANDIDATES_PER_TYPE),
    );
  }
  return result;
}

async function fetchTypeCandidates(
  supabase: SupabaseServerClient,
  questionNo: QuestionNo,
  attemptedIds: Set<string>,
): Promise<FallbackCandidate[]> {
  const collect = async (
    withLifecycle: boolean,
  ): Promise<{
    error: { message: string } | null;
    rows: FallbackCandidate[];
  }> => {
    const rows: FallbackCandidate[] = [];
    for (
      let page = 0;
      page < CANDIDATE_MAX_PAGES_PER_TYPE &&
      rows.length < CANDIDATE_PREVISIBILITY_TARGET;
      page++
    ) {
      let query = supabase
        .from("problems")
        .select(
          "id, title, question_no, topik_level, difficulty, tags, materials",
        )
        .eq("domain", "writing")
        .eq("publish_status", "published")
        .eq("question_no", questionNo);
      if (withLifecycle) {
        query = query.eq("lifecycle_status", "active");
      }
      const result = (await query
        .order("updated_at", { ascending: false })
        .range(
          page * CANDIDATE_PAGE_SIZE,
          (page + 1) * CANDIDATE_PAGE_SIZE - 1,
        )) as unknown as CandidateQueryResult;
      if (result.error) return { error: result.error, rows };

      const pageRows = result.data ?? [];
      for (const row of pageRows) {
        if (rows.length >= CANDIDATE_PREVISIBILITY_TARGET) break;
        if (!isWritingQuestionNo(row.question_no)) continue;
        if (attemptedIds.has(row.id)) continue;
        if (isSeedFixtureProblem(row)) continue;
        rows.push({
          id: row.id,
          title: row.title,
          questionNo: row.question_no,
          topikLevel: row.topik_level ?? null,
          difficulty: row.difficulty ?? null,
          tags: Array.isArray(row.tags) ? row.tags : [],
        });
      }
      if (pageRows.length < CANDIDATE_PAGE_SIZE) break;
    }
    return { error: null, rows };
  };

  let outcome = await collect(true);
  if (outcome.error && outcome.error.message.includes("lifecycle_status")) {
    outcome = await collect(false);
  }
  if (outcome.error) {
    throw new Error(
      `computeFallbackRecommendations(candidates q${questionNo}): ${outcome.error.message}`,
    );
  }
  return outcome.rows;
}

// Third copy of this predicate (writing-availability.ts, writing/server.ts) —
// consolidation is tracked in the implementation brief's follow-up section.
function isSeedFixtureProblem(row: {
  tags: string[] | null;
  materials: unknown;
}): boolean {
  if (
    Array.isArray(row.tags) &&
    row.tags.some((tag) => tag.startsWith("seed:"))
  ) {
    return true;
  }
  if (
    row.materials &&
    typeof row.materials === "object" &&
    !Array.isArray(row.materials) &&
    "seed_source" in row.materials
  ) {
    return (
      (row.materials as { seed_source?: unknown }).seed_source ===
      "wireframe_problem_fixtures"
    );
  }
  return false;
}

function pickOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}
