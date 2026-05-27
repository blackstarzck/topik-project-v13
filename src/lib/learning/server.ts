import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type { Tables } from "../supabase/types";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type LearningGoalRow = Tables<"learning_goals">;

/**
 * Server-only helpers for `learning_goals`. RLS-bound: a caller can only
 * see/write their own row. The DB FK to `profiles(id)` enforces 1:1.
 */

export async function hasLearningGoal(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("learning_goals")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    throw new Error(
      `hasLearningGoal failed for ${userId}: ${error.message}`,
    );
  }
  return (count ?? 0) > 0;
}

export async function getLearningGoal(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<Tables<"learning_goals"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_goals")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `getLearningGoal failed for ${userId}: ${error.message}`,
    );
  }
  return data;
}
