// NOTE: This module is server-only by convention — only consumed by RSC /
// server actions / route handlers. We intentionally do not `import "server-only"`
// here because the `server-only` runtime guard is not a runtime dep of this
// project and vitest can't resolve it. Importers must keep the server-only
// boundary themselves (no "use client" file should import from this path).
import { getLearningGoal } from "../learning/server";
import type { SupabaseServerClient } from "../supabase/server";
import type { Tables } from "../supabase/types";
import { isWritingQuestionNo, questionRotationOrder } from "./next";
import type { RecommendationItemCard } from "./recommendations";
import { QUESTION_NOS, type QuestionNo } from "./types";
import { getWeakDimensions, type WeakDimensionSummary } from "./weakness";
import { getCanonicalWritingProblems } from "../writing/canonical-source";

/**
 * C-01 rule-based transient recommendations. The executable contract lives in
 * this module and its recommendation fallback tests.
 *
 * Runs ONLY when the user has zero stored recommendation_items. Candidates
 * are scored with fixed rule weights over the user's own signals (writing
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
 * "history" when personal signals (writing history / weak dimensions / goal)
 * actually influenced the scores, "rotation" when the pick is pure 51→54
 * rotation.
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

// Score table — executable fallback scoring subset covered by module tests.
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

export async function computeFallbackRecommendations(
  supabase: SupabaseServerClient,
  userId: string,
  questionNo: QuestionNo | null,
): Promise<ComputedRecommendations> {
  const signals = await collectSignals(supabase, userId);
  const candidates = await collectCanonicalCandidates(
    supabase,
    signals.attemptedIds,
    questionNo,
  );
  return buildComputedRecommendations(candidates, signals, questionNo);
}

function buildComputedRecommendations(
  candidates: FallbackCandidate[],
  signals: FallbackSignals,
  questionNo: QuestionNo | null,
): ComputedRecommendations {
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
      : signals.attemptedIds.size > 0 ||
          signals.weakDimensions.length > 0 ||
          signals.goal != null
        ? "history"
        : "rotation";

  return { items, availableTypes, summaryCode };
}

async function collectCanonicalCandidates(
  supabase: SupabaseServerClient,
  attemptedIds: Set<string>,
  questionNo: QuestionNo | null,
): Promise<FallbackCandidate[]> {
  const problems = await getCanonicalWritingProblems({
    supabase,
    questionNo,
  });
  return problems
    .filter((problem) => !attemptedIds.has(problem.id))
    .map((problem) => ({
      id: problem.id,
      title: problem.title,
      questionNo: problem.questionNo,
      topikLevel: problem.topikLevel ?? null,
      difficulty: problem.difficulty ?? null,
      tags: problem.tags ?? [],
    }));
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
    components.push({
      code: "TYPE_ROTATION_NEXT",
      points: SCORE_ROTATION_NEXT,
    });
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
  // Writing history is the core signal — its failure surfaces as a 500 (the
  // screen has an error+retry state). Weak dimensions and the learning goal
  // only tune scores, so their failures degrade to neutral instead of
  // breaking the screen.
  const [history, weakDimensions, goal] = await Promise.all([
    fetchWritingHistorySignals(supabase, userId),
    getWeakDimensions(userId, 5, async () => supabase).catch(
      () => [] as WeakDimensionSummary[],
    ),
    getLearningGoal(userId, async () => supabase).catch(() => null),
  ]);
  return {
    ...history,
    weakDimensions,
    goal: goal
      ? { topik_level: goal.topik_level, target_grade: goal.target_grade }
      : null,
  };
}

async function fetchWritingHistorySignals(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Pick<FallbackSignals, "attemptedIds" | "latestQuestionNo">> {
  const [submissions, drafts] = await Promise.all([
    supabase
      .from("writing_submissions")
      .select("problem_id, question_no, submitted_at")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("writing_drafts")
      .select("problem_id, question_no, updated_at, autosave_status")
      .eq("user_id", userId)
      .neq("autosave_status", "superseded")
      .order("updated_at", { ascending: false }),
  ]);
  if (submissions.error) {
    throw new Error(
      `computeFallbackRecommendations(writing_submissions): ${submissions.error.message}`,
    );
  }
  if (drafts.error) {
    throw new Error(
      `computeFallbackRecommendations(writing_drafts): ${drafts.error.message}`,
    );
  }

  const attemptedIds = new Set<string>();
  const latestCandidates: Array<{ questionNo: QuestionNo; timestamp: string }> =
    [];
  for (const row of submissions.data ?? []) {
    attemptedIds.add(row.problem_id);
    if (isWritingQuestionNo(row.question_no)) {
      latestCandidates.push({
        questionNo: row.question_no,
        timestamp: row.submitted_at,
      });
    }
  }
  for (const row of drafts.data ?? []) {
    attemptedIds.add(row.problem_id);
    if (isWritingQuestionNo(row.question_no)) {
      latestCandidates.push({
        questionNo: row.question_no,
        timestamp: row.updated_at,
      });
    }
  }
  latestCandidates.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latestQuestionNo = latestCandidates[0]?.questionNo ?? null;
  return { attemptedIds, latestQuestionNo };
}
