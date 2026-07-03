"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Tables, TablesInsert } from "../supabase/types";
import { learningGoalQueryKey } from "./queries";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export type SaveLearningGoalInput = TablesInsert<"learning_goals">;

export async function saveLearningGoal(
  input: SaveLearningGoalInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<Tables<"learning_goals">> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_goals")
    .upsert(input)
    .select("*")
    .single();
  if (error) throw error;
  if (!data) {
    throw new Error("saveLearningGoal returned no row");
  }
  return data;
}

export function useSaveLearningGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveLearningGoalInput) => saveLearningGoal(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: learningGoalQueryKey(variables.user_id),
      });
    },
  });
}
