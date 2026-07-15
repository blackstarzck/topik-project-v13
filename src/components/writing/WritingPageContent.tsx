import { Button, Empty, Space } from "antd";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { EssayWriting54Workspace } from "./EssayWriting54Workspace";
import { LongFormWriting53Workspace } from "./LongFormWriting53Workspace";
import { ShortAnswerWriting51Workspace } from "./ShortAnswerWriting51Workspace";
import { ShortAnswerWriting52Workspace } from "./ShortAnswerWriting52Workspace";
import { writingQuestionHref } from "@/lib/writing/routes";
import type {
  QuestionNo,
  WritingDraftRow,
  WritingRetrySeed,
} from "@/lib/writing/types";
import type { WritingProblem } from "@/lib/writing/server";

type Props = {
  questionNo: QuestionNo;
  userId: string;
  problem: WritingProblem | null;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
  canRetryProblemLoad?: boolean;
  returnHref: string;
};

export async function WritingPageContent({
  questionNo,
  userId,
  problem,
  draft,
  retrySeed = null,
  parentSubmissionId = null,
  canRetryProblemLoad = true,
  returnHref,
}: Props) {
  const t = await getTranslations("writing.page");
  const editorT = await getTranslations("writing.editor");
  if (!problem) {
    // D-01 §2 예외 — 지문 로드 실패/문제 없음: 재시도 + 문제 목록 복귀 동선.
    const problemLoadFailed = t("problemLoadFailed", { questionNo });
    const hasPreservedDraft = Boolean(draft);
    const showRetry = canRetryProblemLoad && !hasPreservedDraft;
    const showUnavailableTitle = hasPreservedDraft || !canRetryProblemLoad;
    return (
      <Empty
        className="writing-empty-state"
        description={
          <div className="flex flex-col gap-2">
            <h1 className="writing-empty-state__title">
              {showUnavailableTitle
                ? t("problemUnavailableTitle", { questionNo })
                : problemLoadFailed}
            </h1>
            {hasPreservedDraft ? (
              <p className="m-0 text-sm text-text-secondary">
                {t("problemUnavailableDraftPreserved")}
              </p>
            ) : null}
          </div>
        }
      >
        <Space>
          {showRetry ? (
            <Link
              href={
                writingQuestionHref(questionNo, { returnTo: returnHref }) as never
              }
            >
              <Button type="primary">{t("retry")}</Button>
            </Link>
          ) : null}
          <Link href={returnHref as never} replace>
            <Button type={showRetry ? "default" : "primary"}>
              {editorT("back")}
            </Button>
          </Link>
        </Space>
      </Empty>
    );
  }
  if (problem.kind === "q51") {
    return (
      <ShortAnswerWriting51Workspace
        userId={userId}
        problem={problem}
        draft={draft}
        retrySeed={retrySeed}
        parentSubmissionId={parentSubmissionId}
        returnHref={returnHref}
      />
    );
  }
  if (problem.kind === "q52") {
    return (
      <ShortAnswerWriting52Workspace
        userId={userId}
        problem={problem}
        draft={draft}
        retrySeed={retrySeed}
        parentSubmissionId={parentSubmissionId}
        returnHref={returnHref}
      />
    );
  }
  if (problem.kind === "q53") {
    return (
      <LongFormWriting53Workspace
        userId={userId}
        problem={problem}
        draft={draft}
        retrySeed={retrySeed}
        parentSubmissionId={parentSubmissionId}
        returnHref={returnHref}
      />
    );
  }
  if (problem.kind === "q54") {
    return (
      <EssayWriting54Workspace
        userId={userId}
        problem={problem}
        draft={draft}
        retrySeed={retrySeed}
        parentSubmissionId={parentSubmissionId}
        returnHref={returnHref}
      />
    );
  }
  return null;
}
