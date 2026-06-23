import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { FeedbackPageContent } from "@/components/feedback/FeedbackPageContent";
import { requireUser } from "@/lib/auth/session";
import {
  getFeedbackBundle,
  getSubmission,
  getWritingProblemAvailability,
} from "@/lib/writing/server";
import { isLongForm, type QuestionNo } from "@/lib/writing/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing.page");
  return { title: t("metaTitleFeedbackLong") };
}

export default async function LongFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const submission = await getSubmission(id);
  if (!submission) notFound();
  if (!isLongForm(submission.question_no as QuestionNo)) {
    redirect(`/writing/feedback/short/${id}`);
  }
  const saveLocked = submission.user_id !== user.id;
  // Fetch the bundle whenever a feedback row may exist (complete/failed/partial)
  // so partial results and failed-with-data render instead of infinite loading.
  const bundle =
    submission.feedback_status === "pending" ||
    submission.feedback_status === "analyzing"
      ? null
      : await getFeedbackBundle(id);
  const problemAvailability = await getWritingProblemAvailability(
    submission.problem_id,
  );
  return (
    <WorkspaceBody>
      <FeedbackPageContent
        submission={submission}
        bundle={bundle}
        withSentences
        showSubmissionMeta
        showDimensionGrid={false}
        reloadHref={`/writing/feedback/long/${id}`}
        userId={user.id}
        saveLocked={saveLocked}
        canRetryProblem={problemAvailability.canStart}
      />
    </WorkspaceBody>
  );
}
