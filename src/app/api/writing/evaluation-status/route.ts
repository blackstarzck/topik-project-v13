import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import {
  getExternalEvaluationFeedback,
  getExternalEvaluationStatus,
  mapExternalEvaluationFeedback,
} from "@/lib/writing-api/evaluation";

export async function GET(request: Request) {
  const submissionId = new URL(request.url).searchParams.get("submissionId");
  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: submission, error: submissionError } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }
  if (!submission || submission.user_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const baseUrl = process.env.TALKPIK_WRITING_API_BASE_URL?.trim();
  if (!baseUrl || submission.feedback_status === "complete" || submission.feedback_status === "failed") {
    return NextResponse.json({ feedback_status: submission.feedback_status });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ feedback_status: submission.feedback_status });
  }

  try {
    const status = await getExternalEvaluationStatus({
      baseUrl,
      accessToken,
      submissionId,
    });

    if (status.status === "failed") {
      await supabase
        .from("writing_submissions")
        .update({ feedback_status: "failed" })
        .eq("id", submissionId);
      return NextResponse.json({ feedback_status: "failed" });
    }

    if (status.status !== "graded") {
      const nextStatus = status.status === "processing" ? "analyzing" : "pending";
      if (submission.feedback_status !== nextStatus) {
        await supabase
          .from("writing_submissions")
          .update({ feedback_status: nextStatus })
          .eq("id", submissionId);
      }
      return NextResponse.json({ feedback_status: nextStatus });
    }

    const externalFeedback = await getExternalEvaluationFeedback({
      baseUrl,
      accessToken,
      submissionId,
    });
    const payload = mapExternalEvaluationFeedback(externalFeedback);

    await supabase.from("writing_feedback").upsert({
      submission_id: submissionId,
      user_id: user.id,
      ...payload.feedback,
      raw_ai_result: externalFeedback as unknown as Json,
    });
    await supabase
      .from("feedback_dimension_scores")
      .delete()
      .eq("submission_id", submissionId);
    if (payload.dimensions.length > 0) {
      await supabase.from("feedback_dimension_scores").insert(
        payload.dimensions.map((dimension) => ({
          submission_id: submissionId,
          user_id: user.id,
          ...dimension,
        })),
      );
    }
    await supabase
      .from("sentence_feedback")
      .delete()
      .eq("submission_id", submissionId);
    if (payload.sentences.length > 0) {
      await supabase.from("sentence_feedback").insert(
        payload.sentences.map((sentence) => ({
          submission_id: submissionId,
          user_id: user.id,
          ...sentence,
        })),
      );
    }
    await supabase
      .from("writing_submissions")
      .update({ feedback_status: "complete" })
      .eq("id", submissionId);

    return NextResponse.json({ feedback_status: "complete" });
  } catch {
    return NextResponse.json({ feedback_status: submission.feedback_status });
  }
}
