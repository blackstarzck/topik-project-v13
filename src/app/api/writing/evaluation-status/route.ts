import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import {
  getTalkpikApiBaseUrl,
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

  const baseUrl = getTalkpikApiBaseUrl();
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
    const serviceSupabase = createSupabaseServiceRoleClient();
    const status = await getExternalEvaluationStatus({
      baseUrl,
      accessToken,
      submissionId,
    });
    if (status.submission_id !== submissionId) {
      return NextResponse.json({ feedback_status: submission.feedback_status });
    }

    if (status.status === "failed") {
      const { error: syncError } = await serviceSupabase.rpc("sync_external_writing_feedback" as never, {
        target_submission_id: submissionId,
        next_status: "failed",
        feedback: null,
        dimensions: [],
        sentences: [],
      } as never);
      if (syncError) {
        return NextResponse.json({ feedback_status: submission.feedback_status });
      }
      return NextResponse.json({ feedback_status: "failed" });
    }

    if (status.status !== "graded") {
      const nextStatus = status.status === "processing" ? "analyzing" : "pending";
      if (submission.feedback_status !== nextStatus) {
        const { error: syncError } = await serviceSupabase.rpc("sync_external_writing_feedback" as never, {
          target_submission_id: submissionId,
          next_status: nextStatus,
          feedback: null,
          dimensions: [],
          sentences: [],
        } as never);
        if (syncError) {
          return NextResponse.json({ feedback_status: submission.feedback_status });
        }
      }
      return NextResponse.json({ feedback_status: nextStatus });
    }

    const externalFeedback = await getExternalEvaluationFeedback({
      baseUrl,
      accessToken,
      submissionId,
    });
    if (externalFeedback.submission_id !== submissionId) {
      return NextResponse.json({ feedback_status: submission.feedback_status });
    }
    const payload = mapExternalEvaluationFeedback(externalFeedback);

    const { error: syncError } = await serviceSupabase.rpc("sync_external_writing_feedback" as never, {
      target_submission_id: submissionId,
      next_status: "complete",
      feedback: {
        ...payload.feedback,
        raw_ai_result: externalFeedback as unknown as Json,
      },
      dimensions: payload.dimensions,
      sentences: payload.sentences,
    } as never);
    if (syncError) {
      return NextResponse.json({ feedback_status: submission.feedback_status });
    }

    return NextResponse.json({ feedback_status: "complete" });
  } catch {
    return NextResponse.json({ feedback_status: submission.feedback_status });
  }
}
