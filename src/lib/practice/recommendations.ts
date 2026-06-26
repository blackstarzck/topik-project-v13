import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { filterVisibleProblemIds } from "../problems/visibility";
import { QUESTION_NOS, type QuestionNo } from "./types";

type ClientFactory = () => Promise<SupabaseServerClient>;
const RECOMMENDATION_SCAN_PAGE_SIZE = 8;
const MAX_VISIBILITY_SCAN_ROWS = 200;
const RECOMMENDATION_ITEM_TARGET = 8;

export type RecommendationRunSummary = {
  reasonSummary: string | null;
  sourceType: string;
  createdAt: string;
};

export type RecommendationItemCard = {
  itemId: string;
  problemId: string;
  rank: number;
  reason: string | null;
  estimatedMinutes: number | null;
  weaknessTags: string[];
  title: string;
  questionNo: QuestionNo | null;
};

export type RecommendationBundle = {
  run: RecommendationRunSummary | null;
  items: RecommendationItemCard[];
  availableTypes: QuestionNo[];
};

type JoinedProblem = {
  id: string;
  title: string;
  question_no: number | null;
};

type RawRecommendationItem = {
  id: string;
  run_id: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  estimated_minutes: number | null;
  weakness_tags: string[] | null;
  problems: unknown;
};

function normalizeJoinedProblem(raw: unknown): JoinedProblem | null {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  if (typeof obj.title !== "string") return null;
  const id = typeof obj.id === "string" ? obj.id : null;
  if (!id) return null;
  const qn = obj.question_no;
  return {
    id,
    title: obj.title,
    question_no: typeof qn === "number" ? qn : null,
  };
}

function toQuestionNo(value: number | null): QuestionNo | null {
  if (value == null) return null;
  return (QUESTION_NOS as readonly number[]).includes(value)
    ? (value as QuestionNo)
    : null;
}

export async function queryRecommendationBundleForUser(
  userId: string,
  questionNo: QuestionNo | null,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<RecommendationBundle> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: runData, error: runErr } = await supabase
    .from("recommendation_runs")
    .select("id, source_type, reason_summary, created_at, expires_at")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runErr)
    throw new Error(`queryRecommendationBundle(run): ${runErr.message}`);

  const rawItems = await fetchVisibleRecommendationItems(
    supabase,
    userId,
    questionNo,
    nowIso,
  );

  const items: RecommendationItemCard[] = [];
  const availableTypes = new Set<QuestionNo>();
  const visibleRunIds = new Set<string>();
  for (const row of rawItems) {
    const problem = normalizeJoinedProblem(row.problems);
    if (!problem) continue;
    const qn = toQuestionNo(problem.question_no);
    if (qn != null) availableTypes.add(qn);
    visibleRunIds.add(row.run_id);
    items.push({
      itemId: row.id,
      problemId: row.problem_id,
      rank: row.rank,
      reason: row.reason,
      estimatedMinutes: row.estimated_minutes,
      weaknessTags: Array.isArray(row.weakness_tags) ? row.weakness_tags : [],
      title: problem.title,
      questionNo: qn,
    });
  }

  return {
    run:
      runData && visibleRunIds.has(runData.id)
        ? {
            reasonSummary: null,
            sourceType: runData.source_type,
            createdAt: runData.created_at,
          }
        : null,
    items,
    availableTypes: [...availableTypes],
  };
}

async function fetchVisibleRecommendationItems(
  supabase: SupabaseServerClient,
  userId: string,
  questionNo: QuestionNo | null,
  nowIso: string,
): Promise<RawRecommendationItem[]> {
  const visibleRows: RawRecommendationItem[] = [];

  for (
    let offset = 0;
    offset < MAX_VISIBILITY_SCAN_ROWS &&
    visibleRows.length < RECOMMENDATION_ITEM_TARGET;
    offset += RECOMMENDATION_SCAN_PAGE_SIZE
  ) {
    let itemQuery = supabase
      .from("recommendation_items")
      .select(
        "id, run_id, problem_id, rank, reason, estimated_minutes, weakness_tags," +
          " recommendation_runs!inner(expires_at)," +
          " problems!inner(id, title, question_no, publish_status)",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("problems.publish_status", "published")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`, {
        referencedTable: "recommendation_runs",
      });
    if (questionNo != null) {
      itemQuery = itemQuery.eq("problems.question_no", questionNo);
    }

    const { data, error } = await itemQuery
      .order("rank", { ascending: true })
      .range(offset, offset + RECOMMENDATION_SCAN_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`queryRecommendationBundle(items): ${error.message}`);
    }

    const rows = (data ?? []) as unknown as RawRecommendationItem[];
    const visibleIds = await filterVisibleProblemIds(
      supabase,
      rows.map((row) => row.problem_id),
    );
    visibleRows.push(...rows.filter((row) => visibleIds.has(row.problem_id)));

    if (rows.length < RECOMMENDATION_SCAN_PAGE_SIZE) break;
  }

  return visibleRows.slice(0, RECOMMENDATION_ITEM_TARGET);
}
