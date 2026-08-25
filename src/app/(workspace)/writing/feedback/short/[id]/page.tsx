import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { FeedbackPageContent } from "@/components/feedback/FeedbackPageContent";
import { requireUser } from "@/lib/auth/session";
import { isSubmissionSavedToLibrary } from "@/lib/library/server";
import { APP_ROUTES } from "@/lib/routes";
import {
  getFeedbackBundle,
  getNextWritingProblemStartHref,
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
  if (
    submission.feedback_status === "pending" ||
    submission.feedback_status === "analyzing"
  ) {
    redirect(APP_ROUTES.library);
  }
  // RLS already scopes rows to the owner; this is an explicit ownership signal
  // so the save action can render its permission-locked state if the row ever
  // surfaces read-only (e.g. future shared view).
  const saveLocked = submission.user_id !== user.id;
  // Fetch the bundle whenever a feedback row may exist (complete/failed/partial)
  // so the page can render partial results and failed-with-data states instead
  // of an infinite loading modal.
  const [bundle, problemAvailability, alreadySaved, nextHref] =
    await Promise.all([
      getFeedbackBundle(id),
      getWritingProblemAvailability(submission.problem_id),
      isSubmissionSavedToLibrary(user.id, id),
      getNextWritingProblemStartHref({
        currentProblemId: submission.problem_id,
        questionNo: submission.question_no,
        returnTo: `/writing/feedback/short/${encodeURIComponent(id)}`,
      }),
    ]);
  return (
    <WorkspaceBody size="full">
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
        alreadySaved={alreadySaved}
        canRetryProblem={problemAvailability.canStart}
        nextHref={nextHref}
      />
    </WorkspaceBody>
  );
}
