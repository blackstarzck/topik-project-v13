import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FeedbackPageContent } from "@/components/feedback/FeedbackPageContent";
import { requireUser } from "@/lib/auth/session";
import {
  getFeedbackBundle,
  getSubmission,
} from "@/lib/writing/server";
import { isShortAnswer, type QuestionNo } from "@/lib/writing/types";

export const metadata: Metadata = { title: "단답 피드백 — TALKPIK" };

export default async function ShortFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const submission = await getSubmission(id);
  if (!submission) notFound();
  if (!isShortAnswer(submission.question_no as QuestionNo)) {
    redirect(`/writing/feedback/long/${id}`);
  }
  const bundle =
    submission.feedback_status === "complete"
      ? await getFeedbackBundle(id)
      : null;
  return (
    <FeedbackPageContent
      submission={submission}
      bundle={bundle}
      withSentences={false}
    />
  );
}
