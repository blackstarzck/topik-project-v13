"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import {
  computeComparisonMetrics,
  generateNarrative,
} from "./comparison-service";
import { generateMockFeedback } from "./feedback-service";
import type { QuestionNo } from "./types";

export type SubmitWritingInput = {
  draft_id?: string | null;
  problem_id: string;
  question_no: QuestionNo;
  answer_text: string;
  answer_json?: Record<string, unknown> | null;
  char_count: number;
};

export type SubmitWritingResult = {
  submissionId: string;
  questionNo: QuestionNo;
};

export async function submitWritingAction(
  input: SubmitWritingInput,
): Promise<SubmitWritingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mock = generateMockFeedback({
    question_no: input.question_no,
    char_count: input.char_count,
    answer_text: input.answer_text,
  });

  const submissionPayload: Record<string, unknown> = {
    problem_id: input.problem_id,
    question_no: input.question_no,
    answer_text: input.answer_text,
    answer_json: input.answer_json ?? null,
    char_count: input.char_count,
  };
  if (input.draft_id) submissionPayload.draft_id = input.draft_id;

  const { data, error } = await supabase.rpc(
    "submit_writing_with_feedback" as never,
    {
      submission: submissionPayload,
      feedback: mock.feedback,
      dimensions: mock.dimensions,
      sentences: mock.sentences,
    } as never,
  );
  if (error) throw new Error(`submitWriting failed: ${error.message}`);
  const submissionId = (data as unknown as string) ?? "";
  if (!submissionId) {
    throw new Error("submitWriting: RPC returned empty submission id");
  }
  return { submissionId, questionNo: input.question_no };
}

export type CreateComparisonReportInput = {
  current_id: string;
  previous_id?: string | null;
};

export async function createComparisonReportAction(
  input: CreateComparisonReportInput,
): Promise<{ reportId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentSub, error: curErr } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", input.current_id)
    .maybeSingle();
  if (curErr) throw new Error(`comparison: current ${curErr.message}`);
  if (!currentSub) throw new Error("comparison: current submission missing");

  const { data: prevSub } = input.previous_id
    ? await supabase
        .from("writing_submissions")
        .select("*")
        .eq("id", input.previous_id)
        .maybeSingle()
    : { data: null };

  const [{ data: curFeedback }, { data: curDims }] = await Promise.all([
    supabase
      .from("writing_feedback")
      .select("*")
      .eq("submission_id", currentSub.id)
      .maybeSingle(),
    supabase
      .from("feedback_dimension_scores")
      .select("*")
      .eq("submission_id", currentSub.id),
  ]);

  const prev =
    prevSub && input.previous_id
      ? await Promise.all([
          supabase
            .from("writing_feedback")
            .select("*")
            .eq("submission_id", input.previous_id)
            .maybeSingle(),
          supabase
            .from("feedback_dimension_scores")
            .select("*")
            .eq("submission_id", input.previous_id),
        ])
      : null;

  const metrics = computeComparisonMetrics({
    currentScore: curFeedback?.score_total ?? null,
    previousScore: prev?.[0].data?.score_total ?? null,
    currentDims: curDims ?? [],
    previousDims: prev?.[1].data ?? null,
    currentChars: currentSub.char_count,
    previousChars: prevSub?.char_count ?? null,
  });
  const narrative = generateNarrative(metrics);

  const { data: reportId, error: rpcErr } = await supabase.rpc(
    "create_comparison_report_with_metrics" as never,
    {
      current_id: input.current_id,
      previous_id: input.previous_id ?? null,
      metrics: metrics as unknown as Record<string, unknown>,
      narrative,
      ai_model: "mock-v1",
    } as never,
  );
  if (rpcErr) throw new Error(`comparison rpc: ${rpcErr.message}`);
  return { reportId: (reportId as unknown as string) ?? "" };
}
