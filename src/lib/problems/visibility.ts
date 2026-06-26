// NOTE: server-only by convention. This file wraps DB visibility RPCs and
// should only be used from RSC, route handlers, server actions, or server libs.
import type { SupabaseServerClient } from "../supabase/server";

type VisibilityRpcError = {
  code?: string;
  message?: string;
};

function isMissingVisibilityRpcError(
  error: VisibilityRpcError,
  functionName: string,
): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST202" ||
    message.includes(`function public.${functionName}`) ||
    message.includes(`${functionName}(`)
  );
}

function canFallbackForMissingVisibilityRpc(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function filterVisibleProblemIds(
  supabase: SupabaseServerClient,
  problemIds: readonly string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(problemIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Set();

  const { data, error } = await supabase.rpc(
    "filter_visible_writing_problem_ids",
    {
      p_problem_ids: uniqueIds,
    },
  );

  if (error) {
    if (
      canFallbackForMissingVisibilityRpc() &&
      isMissingVisibilityRpcError(error, "filter_visible_writing_problem_ids")
    ) {
      return new Set(uniqueIds);
    }
    throw new Error(`filterVisibleProblemIds: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.problem_id));
}

export async function isWritingProblemVisibleToCaller(
  supabase: SupabaseServerClient,
  problemId: string,
  questionNo: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "is_writing_problem_visible_to_caller",
    {
      p_problem_id: problemId,
      p_question_no: questionNo,
    },
  );

  if (error) {
    if (
      canFallbackForMissingVisibilityRpc() &&
      isMissingVisibilityRpcError(error, "is_writing_problem_visible_to_caller")
    ) {
      return true;
    }
    throw new Error(`isWritingProblemVisibleToCaller: ${error.message}`);
  }

  return data === true;
}
