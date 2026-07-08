import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { WritingPageContent } from "@/components/writing/WritingPageContent";
import { requireUser } from "@/lib/auth/session";
import {
  getActiveDraft,
  getRetrySubmissionSeed,
  getWritingProblem,
  isProblemIdLikeUuid,
} from "@/lib/writing/server";
import type { QuestionNo } from "@/lib/writing/types";

export type WritingQuestionSearchParams = Promise<{
  problem?: string;
  fresh?: string;
  retrySubmission?: string;
}>;

export async function generateWritingQuestionMetadata(): Promise<Metadata> {
  const t = await getTranslations("writing.page");
  return { title: t("metaTitle") };
}

export async function renderWritingQuestionPage(
  questionNo: QuestionNo,
  searchParams: WritingQuestionSearchParams,
) {
  const user = await requireUser();
  const { problem: problemId, fresh, retrySubmission } = await searchParams;
  const problem = await getWritingProblem(questionNo, problemId, undefined, {
    userId: user.id,
  });
  const canRetryProblemLoad = Boolean(problemId);
  const startFresh = fresh === "1";
  const activeDraftProblemId = problem?.id ?? problemId;
  const shouldLoadActiveDraft =
    Boolean(retrySubmission) || (!startFresh && Boolean(activeDraftProblemId));
  const draft =
    shouldLoadActiveDraft && problem
      ? await getActiveDraft(user.id, problem.id)
      : shouldLoadActiveDraft && isProblemIdLikeUuid(activeDraftProblemId)
        ? await getActiveDraft(user.id, activeDraftProblemId)
        : null;
  const retrySeed =
    retrySubmission && problem
      ? await getRetrySubmissionSeed({
          userId: user.id,
          submissionId: retrySubmission,
          problemId: problem.id,
          questionNo,
        })
      : null;

  return (
    <WritingPageContent
      questionNo={questionNo}
      userId={user.id}
      problem={problem}
      draft={draft}
      retrySeed={draft ? null : retrySeed}
      parentSubmissionId={retrySeed?.parent_submission_id ?? null}
      canRetryProblemLoad={canRetryProblemLoad}
    />
  );
}
