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
 * Phase 6 — weakness practice helpers (Task 6 §weakness).
 *
 * RLS contract:
 *   - `feedback_dimension_scores` is owner-scoped (Phase 5 RLS). The caller
 *     MUST be authenticated via the regular server client; we never use the
 *     service role.
 *   - `recommendation_items` + `recommendation_runs` are both
 *     `user_id = auth.uid()` scoped — joining them here is safe.
 *   - `problems` exposes rows where `publish_status = 'published'`.
 *
 * Fallback chain for `getWeaknessRecommendations`:
 *   1) Pre-computed active items (status='active', run not expired) → up to 4.
 *   2) Tag-overlap fallback against published problems using weak dimensions.
 *
 * `getWeakDimensions` is independently gated by a count threshold (default 5)
 * so we don't suggest "weak" dimensions from one or two noisy scores. When
 * the gate fails the function returns `[]` and the UI shows the "더 많은
 * 글쓰기로 약점 분석을 받아보세요" CTA.
 */

export const WEAKNESS_DIMENSIONS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
  "language",
] as const;

export type WeaknessDimension = (typeof WEAKNESS_DIMENSIONS)[number];

export type WeakDimensionSummary = {
  dimension: WeaknessDimension;
  avgScore: number;
  sampleCount: number;
};

/**
 * X-07 §2 (탭 4개) — the four weakness tabs the screen always shows, in spec
 * order: 문법 / 어휘 / 구성 / 주제 적합성. Even dimensions that haven't cleared
 * the sample gate render as a disabled tab with the remaining-answer count.
 */
export const DIMENSION_TAB_ORDER = [
  "grammar",
  "vocab",
  "structure",
  "topic_fit",
] as const satisfies readonly WeaknessDimension[];

export type DimensionTabSummary = {
  dimension: WeaknessDimension;
  /** avg score on a 0..100 scale (normalized across score_max), or null when no samples. */
  avgScore: number | null;
  sampleCount: number;
  /** True once sampleCount >= threshold (tab is interactive). */
  ready: boolean;
  /** How many more scored answers are needed to clear the gate (0 when ready). */
  neededAnswerCount: number;
};

export type WeaknessRecommendation = {
  problemId: Tables<"problems">["id"];
  title: Tables<"problems">["title"];
  domain: Tables<"problems">["domain"];
  questionNo: Tables<"problems">["question_no"];
  rank: number | null;
  reason: string | null;
  source: "recommendation" | "tag_fallback";
  /**
   * recommendation_items.id when source === "recommendation" — used by the
   * view to flip the row to status='consumed' on start (RLS owner-update).
   * Absent for tag_fallback (no backing recommendation row).
   */
  itemId?: string | null;
  /** recommendation_items.estimated_minutes (optional). */
  estimatedMinutes?: number | null;
};

type DimensionScoreSlice = Pick<
  Tables<"feedback_dimension_scores">,
  "dimension" | "score" | "score_max"
>;

/**
 * Return up to 2 dimensions the user is weakest in, ascending by avg score.
 *
 * Threshold gate: only dimensions with at least `threshold` scored entries
 * are eligible. When NO dimensions clear the gate the array is empty — the
 * UI surfaces a CTA instead of "weak in everything" noise.
 *
 * NULL scores are skipped from the average; the count gate uses the number of
 * non-null entries to stay consistent with the avg.
 */
export async function getWeakDimensions(
  userId: string,
  threshold = 5,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WeakDimensionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_dimension_scores")
    .select("dimension, score, score_max")
    .eq("user_id", userId);
  if (error) throw new Error(`getWeakDimensions: ${error.message}`);

  const rows = (data ?? []) as DimensionScoreSlice[];
  if (rows.length === 0) return [];

  const buckets = new Map<
    WeaknessDimension,
    { sumNorm: number; count: number }
  >();
  for (const row of rows) {
    if (!isWeaknessDimension(row.dimension)) continue;
    if (row.score == null) continue;
    // Normalize to 0..1 so different score_max ranges compare fairly.
    const max =
      row.score_max != null && row.score_max > 0 ? row.score_max : 100;
    const normalized = row.score / max;
    const slot = buckets.get(row.dimension) ?? { sumNorm: 0, count: 0 };
    slot.sumNorm += normalized;
    slot.count += 1;
    buckets.set(row.dimension, slot);
  }

  const eligible: WeakDimensionSummary[] = [];
  for (const [dimension, slot] of buckets) {
    if (slot.count < threshold) continue;
    eligible.push({
      dimension,
      avgScore: slot.sumNorm / slot.count,
      sampleCount: slot.count,
    });
  }

  eligible.sort((a, b) => a.avgScore - b.avgScore);
  return eligible.slice(0, 2);
}

/**
 * X-07 §2 — summaries for ALL FOUR weakness tabs (not just the ones that
 * cleared the gate). Under-sampled dimensions come back with `ready=false`
 * and a `neededAnswerCount` so the tab can render disabled with "N개 답안 더
 * 필요" guidance. Dimensions with zero samples report `avgScore=null` and the
 * full `threshold` as the needed count.
 *
 * Same RLS contract / normalization as `getWeakDimensions` (owner-scoped
 * read, score normalized to 0..1 against score_max, then surfaced 0..100).
 */
export async function getDimensionTabSummaries(
  userId: string,
  threshold = 5,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<DimensionTabSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_dimension_scores")
    .select("dimension, score, score_max")
    .eq("user_id", userId);
  if (error) throw new Error(`getDimensionTabSummaries: ${error.message}`);

  const rows = (data ?? []) as DimensionScoreSlice[];
  const buckets = new Map<
    WeaknessDimension,
    { sumNorm: number; count: number }
  >();
  for (const row of rows) {
    if (!isWeaknessDimension(row.dimension)) continue;
    if (row.score == null) continue;
    const max =
      row.score_max != null && row.score_max > 0 ? row.score_max : 100;
    const normalized = row.score / max;
    const slot = buckets.get(row.dimension) ?? { sumNorm: 0, count: 0 };
    slot.sumNorm += normalized;
    slot.count += 1;
    buckets.set(row.dimension, slot);
  }

  return DIMENSION_TAB_ORDER.map((dimension) => {
    const slot = buckets.get(dimension);
    const sampleCount = slot?.count ?? 0;
    const ready = sampleCount >= threshold;
    return {
      dimension,
      avgScore:
        slot && slot.count > 0
          ? Math.round((slot.sumNorm / slot.count) * 100)
          : null,
      sampleCount,
      ready,
      neededAnswerCount: ready ? 0 : Math.max(0, threshold - sampleCount),
    } satisfies DimensionTabSummary;
  });
}

type RecommendationItemJoined = {
  id: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  estimated_minutes: number | null;
  weakness_tags: string[] | null;
  recommendation_runs:
    | {
        expires_at: string | null;
      }
    | { expires_at: string | null }[]
    | null;
  problems:
    | {
        id: string;
        title: string;
        domain: string;
        question_no: number | null;
        publish_status: string;
        lifecycle_status?: string | null;
      }
    | {
        id: string;
        title: string;
        domain: string;
        question_no: number | null;
        publish_status: string;
        lifecycle_status?: string | null;
      }[]
    | null;
};

/**
 * Up to 4 problem recommendations for the user's weakness page.
 *
 * Step 1: pre-computed `recommendation_items` (status='active') joined to
 *         `recommendation_runs` so we can filter out expired runs. The DB
 *         column lives on the run, not the item.
 * Step 2: when step 1 is empty, fall back to a tag-overlap query against
 *         `problems` using the weak dimension names as tags. Caller's UI
 *         shows a "추천 문제가 없습니다" empty state if both are empty.
 */
export async function getWeaknessRecommendations(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WeaknessRecommendation[]> {
  const supabase = await createClient();

  const nowIso = new Date().toISOString();
  const { data: itemsData, error: itemsError } = await supabase
    .from("recommendation_items")
    .select(
      "id, problem_id, rank, reason, estimated_minutes, weakness_tags," +
        " recommendation_runs!inner(expires_at)," +
        " problems!inner(id, title, domain, question_no, publish_status, lifecycle_status)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`, {
      referencedTable: "recommendation_runs",
    })
    .order("rank", { ascending: true })
    .limit(4);
  if (itemsError) {
    throw new Error(`getWeaknessRecommendations(items): ${itemsError.message}`);
  }

  const rows = (itemsData ?? []) as unknown as RecommendationItemJoined[];
  const fromItems: WeaknessRecommendation[] = [];
  for (const row of rows) {
    const problem = pickOne(row.problems);
    if (!problem) continue;
    if (problem.publish_status !== "published") continue;
    if (problem.lifecycle_status !== "active") continue;
    fromItems.push({
      problemId: problem.id,
      title: problem.title,
      domain: problem.domain as WeaknessRecommendation["domain"],
      questionNo: problem.question_no,
      rank: row.rank,
      reason: row.reason,
      source: "recommendation",
      itemId: row.id ?? undefined,
      estimatedMinutes: row.estimated_minutes ?? undefined,
    });
  }
  if (fromItems.length > 0) return fromItems.slice(0, 4);

  // Fallback: query published problems whose tags overlap with the user's
  // weak dimensions. If we couldn't compute weak dimensions either (e.g. not
  // enough samples), return [] so the UI can render its CTA.
  const weak = await getWeakDimensions(userId, 5, async () => supabase);
  if (weak.length === 0) return [];

  const tags = weak.map((w) => w.dimension);
  const { data: probData, error: probError } = await supabase
    .from("problems")
    .select("id, title, domain, question_no")
    .eq("publish_status", "published")
    .eq("lifecycle_status", "active")
    .overlaps("tags", tags)
    .order("updated_at", { ascending: false })
    .limit(4);
  if (probError) {
    throw new Error(
      `getWeaknessRecommendations(tag-fallback): ${probError.message}`,
    );
  }
  return (probData ?? []).map((p) => ({
    problemId: p.id,
    title: p.title,
    domain: p.domain as WeaknessRecommendation["domain"],
    questionNo: p.question_no,
    rank: null,
    reason: null,
    source: "tag_fallback" as const,
  }));
}

function isWeaknessDimension(value: unknown): value is WeaknessDimension {
  return (
    typeof value === "string" &&
    (WEAKNESS_DIMENSIONS as readonly string[]).includes(value)
  );
}

function pickOne<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}
