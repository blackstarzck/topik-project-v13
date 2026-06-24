"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import {
  isFeedbackComplete,
  type FeedbackBundle,
  type FeedbackStatus,
  type WritingDraftRow,
  type WritingSubmissionRow,
} from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export function draftQueryKey(userId: string, problemId: string) {
  return ["writing-draft", userId, problemId] as const;
}

export function submissionQueryKey(submissionId: string) {
  return ["writing-submission", submissionId] as const;
}

export function feedbackBundleKey(submissionId: string) {
  return ["writing-feedback-bundle", submissionId] as const;
}

export function feedbackStatusKey(submissionId: string) {
  return ["writing-feedback-status", submissionId] as const;
}

export function comparisonReportKey(reportId: string) {
  return ["writing-comparison-report", reportId] as const;
}

export async function fetchDraft(
  userId: string,
  problemId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<WritingDraftRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("writing_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .neq("autosave_status", "superseded")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSubmission(
  submissionId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<WritingSubmissionRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchFeedbackBundle(
  submissionId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<FeedbackBundle | null> {
  const supabase = createClient();
  const [fb, dims, sents] = await Promise.all([
    supabase
      .from("writing_feedback")
      .select("*")
      .eq("submission_id", submissionId)
      .maybeSingle(),
    supabase
      .from("feedback_dimension_scores")
      .select("*")
      .eq("submission_id", submissionId),
    supabase
      .from("sentence_feedback")
      .select("*")
      .eq("submission_id", submissionId)
      .order("sentence_index", { ascending: true }),
  ]);
  if (fb.error || dims.error || sents.error) {
    throw fb.error ?? dims.error ?? sents.error;
  }
  if (!fb.data) return null;
  return {
    feedback: fb.data,
    dimensions: dims.data ?? [],
    sentences: sents.data ?? [],
  };
}

export async function fetchFeedbackStatus(
  submissionId: string,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<FeedbackStatus | null> {
  const syncResponse = await fetch(
    `/api/writing/evaluation-status?submissionId=${encodeURIComponent(submissionId)}`,
    { cache: "no-store" },
  );
  if (syncResponse.ok) {
    const body = (await syncResponse.json()) as {
      feedback_status?: FeedbackStatus | null;
    };
    if (body.feedback_status) return body.feedback_status;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("feedback_status")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw error;
  return data?.feedback_status ?? null;
}

export function useDraft(userId: string, problemId: string) {
  return useQuery({
    queryKey: draftQueryKey(userId, problemId),
    queryFn: () => fetchDraft(userId, problemId),
  });
}

const POLL_INTERVAL_MS = 10000;
const POLL_MAX_ATTEMPTS = 6;

export function useFeedbackStatus(submissionId: string) {
  return useQuery({
    queryKey: feedbackStatusKey(submissionId),
    queryFn: () => fetchFeedbackStatus(submissionId),
    refetchInterval: (query) => {
      if (query.state.dataUpdateCount >= POLL_MAX_ATTEMPTS) return false;
      const status = query.state.data;
      if (status === null) return false;
      if (!status) return POLL_INTERVAL_MS;
      return isFeedbackComplete(status) ? false : POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });
}
