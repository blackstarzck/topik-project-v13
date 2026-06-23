import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { FeedbackPageContent } from "@/components/feedback/FeedbackPageContent";
import { requireUser } from "@/lib/auth/session";
import {
  getFeedbackBundle,
  getSubmission,
  getWritingProblemAvailability,
} from "@/lib/writing/server";
import { isShortAnswer, type QuestionNo } from "@/lib/writing/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing.page");
  return { title: t("metaTitleFeedbackShort") };
}

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
  const problemAvailability = await getWritingProblemAvailability(
    submission.problem_id,
  );
  return (
    <FeedbackPageContent
      submission={submission}
      bundle={bundle}
      withSentences
      dimensionCardLimit={4}
      showDetailPanel={false}
      retryLabelKey="retryDefault"
      reloadHref={`/writing/feedback/short/${id}`}
      userId={user.id}
      saveLocked={saveLocked}
      canRetryProblem={problemAvailability.canStart}
    />
  );
}
