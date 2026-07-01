"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ANALYSIS_POLL_INTERVAL_MS,
  ANALYSIS_POLL_MAX_ATTEMPTS,
} from "../request-control/policies";
import { fetchWithGoogleAnalytics } from "../analytics/google-analytics";
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
  const syncResponse = await fetchWithGoogleAnalytics(
    `/api/writing/evaluation-status?submissionId=${encodeURIComponent(submissionId)}`,
    { cache: "no-store" },
    { apiName: "writing_evaluation_status" },
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

export const FEEDBACK_STATUS_POLL_INTERVAL_MS = ANALYSIS_POLL_INTERVAL_MS;
export const FEEDBACK_STATUS_POLL_MAX_ATTEMPTS = ANALYSIS_POLL_MAX_ATTEMPTS;

export function getFeedbackStatusRefetchInterval(
  status: FeedbackStatus | null | undefined,
  dataUpdateCount: number,
): false | typeof FEEDBACK_STATUS_POLL_INTERVAL_MS {
  if (dataUpdateCount >= FEEDBACK_STATUS_POLL_MAX_ATTEMPTS) return false;
  if (status === null) return false;
  if (!status) return FEEDBACK_STATUS_POLL_INTERVAL_MS;
  return isFeedbackComplete(status) ? false : FEEDBACK_STATUS_POLL_INTERVAL_MS;
}

export function isFeedbackStatusPollingExhausted(
  status: FeedbackStatus | null | undefined,
  dataUpdateCount: number,
): boolean {
  return Boolean(
    status &&
    !isFeedbackComplete(status) &&
    dataUpdateCount >= FEEDBACK_STATUS_POLL_MAX_ATTEMPTS,
  );
}

export function useFeedbackStatus(submissionId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: feedbackStatusKey(submissionId),
    queryFn: () => fetchFeedbackStatus(submissionId),
    refetchInterval: (query) => {
      return getFeedbackStatusRefetchInterval(
        query.state.data,
        query.state.dataUpdateCount,
      );
    },
    refetchIntervalInBackground: false,
  });
  const observedDataUpdateCount =
    queryClient
      .getQueryCache()
      .find({ queryKey: feedbackStatusKey(submissionId) })?.state
      .dataUpdateCount ?? 0;

  return {
    ...query,
    pollingExhausted: isFeedbackStatusPollingExhausted(
      query.data,
      observedDataUpdateCount,
    ),
  };
}
