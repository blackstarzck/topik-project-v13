"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Tables } from "../supabase/types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export function learningGoalQueryKey(userId: string) {
  return ["learning-goal", userId] as const;
}

export async function fetchLearningGoal(
  userId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<Tables<"learning_goals"> | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_goals")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useLearningGoal(userId: string | null) {
  return useQuery({
    queryKey: userId
      ? learningGoalQueryKey(userId)
      : (["learning-goal", "anon"] as const),
    queryFn: () => (userId ? fetchLearningGoal(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
  });
}
