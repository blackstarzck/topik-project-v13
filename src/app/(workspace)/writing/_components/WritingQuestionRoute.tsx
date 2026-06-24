import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { WritingPageContent } from "@/components/writing/WritingPageContent";
import { requireUser } from "@/lib/auth/session";
import {
  getActiveDraft,
  getWritingProblem,
  isProblemIdLikeUuid,
} from "@/lib/writing/server";
import type { QuestionNo } from "@/lib/writing/types";

export type WritingQuestionSearchParams = Promise<{
  problem?: string;
  fresh?: string;
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
  const { problem: problemId, fresh } = await searchParams;
  const problem = await getWritingProblem(questionNo, problemId);
  const canRetryProblemLoad = Boolean(problemId);
  const startFresh = fresh === "1";
  const draft =
    !startFresh && problem
      ? await getActiveDraft(user.id, problem.id)
      : !startFresh && isProblemIdLikeUuid(problemId)
        ? await getActiveDraft(user.id, problemId)
        : null;

  return (
    <WritingPageContent
      questionNo={questionNo}
      userId={user.id}
      problem={problem}
      draft={draft}
      canRetryProblemLoad={canRetryProblemLoad}
    />
  );
}
