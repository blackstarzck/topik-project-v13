import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FeedbackPageContent } from "@/components/feedback/FeedbackPageContent";
import { requireUser } from "@/lib/auth/session";
import { getFeedbackBundle, getSubmission } from "@/lib/writing/server";
import { isShortAnswer, type QuestionNo } from "@/lib/writing/types";

export const metadata: Metadata = { title: "단답 피드백 — TALKPIK" };

export default async function ShortFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const submission = await getSubmission(id);
  if (!submission) notFound();
  if (!isShortAnswer(submission.question_no as QuestionNo)) {
    redirect(`/writing/feedback/long/${id}`);
  }
  // RLS already scopes rows to the owner; this is an explicit ownership signal
  // so the save action can render its permission-locked state if the row ever
  // surfaces read-only (e.g. future shared view).
  const saveLocked = submission.user_id !== user.id;
  // Fetch the bundle whenever a feedback row may exist (complete/failed/partial)
  // so the page can render partial results and failed-with-data states instead
  // of an infinite loading modal.
  const bundle =
    submission.feedback_status === "pending" ||
    submission.feedback_status === "analyzing"
      ? null
      : await getFeedbackBundle(id);
  return (
    <FeedbackPageContent
      submission={submission}
      bundle={bundle}
      withSentences={false}
      reloadHref={`/writing/feedback/short/${id}`}
      userId={user.id}
      saveLocked={saveLocked}
    />
  );
}
