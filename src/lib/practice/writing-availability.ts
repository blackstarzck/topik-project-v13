// NOTE: server-only by convention. This helper is consumed by route handlers
// and RSC/server code only; do not import it from client components.
import { filterVisibleProblemIds } from "../problems/visibility";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { QUESTION_NOS, type QuestionNo } from "./types";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type WritingAvailability = {
  availableTypes: QuestionNo[];
  lockedTypes: QuestionNo[];
  hasAny: boolean;
};

type ProblemAvailabilityRow = {
  id: string;
  question_no: number | null;
  tags?: string[] | null;
  materials?: unknown;
};

type ProblemAvailabilityQueryResult = {
  data: ProblemAvailabilityRow[] | null;
  error: { message: string } | null;
};

const MAX_AVAILABILITY_ROWS = 500;

function isQuestionNo(value: number | null | undefined): value is QuestionNo {
  return (QUESTION_NOS as readonly number[]).includes(value ?? -1);
}

function isSeedFixtureProblem(row: ProblemAvailabilityRow): boolean {
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
    return row.materials.seed_source === "wireframe_problem_fixtures";
  }
  return false;
}

async function queryPublishedWritingProblems(
  supabase: SupabaseServerClient,
  withLifecycle: boolean,
): Promise<ProblemAvailabilityQueryResult> {
  let query = supabase
    .from("problems")
    .select("id, question_no, tags, materials")
    .eq("domain", "writing")
    .eq("publish_status", "published");
  if (withLifecycle) {
    query = query.eq("lifecycle_status", "active");
  }

  return (await query
    .order("question_no", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_AVAILABILITY_ROWS)) as unknown as ProblemAvailabilityQueryResult;
}

export async function getWritingAvailability(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WritingAvailability> {
  const supabase = await createClient();
  let result = await queryPublishedWritingProblems(supabase, true);
  if (result.error && result.error.message.includes("lifecycle_status")) {
    result = await queryPublishedWritingProblems(supabase, false);
  }
  if (result.error) {
    throw new Error(`getWritingAvailability: ${result.error.message}`);
  }

  const candidates = (result.data ?? []).filter(
    (row) => isQuestionNo(row.question_no) && !isSeedFixtureProblem(row),
  );
  const visibleIds = await filterVisibleProblemIds(
    supabase,
    candidates.map((row) => row.id),
  );
  const availableSet = new Set<QuestionNo>();
  for (const row of candidates) {
    if (visibleIds.has(row.id) && isQuestionNo(row.question_no)) {
      availableSet.add(row.question_no);
    }
  }

  const availableTypes = QUESTION_NOS.filter((qn) => availableSet.has(qn));
  const lockedTypes = QUESTION_NOS.filter((qn) => !availableSet.has(qn));
  return {
    availableTypes,
    lockedTypes,
    hasAny: availableTypes.length > 0,
  };
}
