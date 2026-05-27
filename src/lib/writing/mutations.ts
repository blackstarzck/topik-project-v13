"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  createComparisonReportAction,
  submitWritingAction,
  type CreateComparisonReportInput,
  type SubmitWritingInput,
  type SubmitWritingResult,
} from "./server-actions";
import { draftQueryKey } from "./queries";
import type { WritingDraftInsert, WritingDraftRow } from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export async function upsertDraft(
  input: WritingDraftInsert,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<WritingDraftRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("writing_drafts")
    .upsert(input, { onConflict: "user_id,problem_id" })
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("upsertDraft: empty row");
  return data;
}

export function useUpsertDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WritingDraftInsert) => upsertDraft(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: draftQueryKey(variables.user_id, variables.problem_id),
      });
    },
  });
}

// Phase 6 R-DEAD-INVALIDATE: previously this mutation invalidated submission /
// feedback bundle / feedback status keys keyed by the newly-minted submissionId.
// Those keys have no mounted query at the time of invalidation (the caller
// navigates to /feedback/[id] right after, and that page mounts fresh), so the
// invalidations were dead. Drop them.
export function useSubmitWriting() {
  return useMutation<SubmitWritingResult, Error, SubmitWritingInput>({
    mutationFn: (input) => submitWritingAction(input),
  });
}

export function useCreateComparisonReport() {
  return useMutation<
    { reportId: string },
    Error,
    CreateComparisonReportInput
  >({
    mutationFn: (input) => createComparisonReportAction(input),
  });
}
