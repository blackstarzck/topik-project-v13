"use client";

import { Alert } from "antd";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ReportPageHeader } from "@/components/shared/ReportPageHeader";
import { DetailedFeedbackPanel } from "./DetailedFeedbackPanel";
import { DimensionCardGrid } from "./DimensionCardGrid";
import { FeedbackRecommendationCards } from "./FeedbackRecommendationCards";
import { FeedbackReportOverview } from "./FeedbackReportOverview";
import { FeedbackSummary } from "./FeedbackSummary";
import { FeedbackActionGroup, NextActionBar } from "./NextActionBar";
import { SentenceFeedbackList } from "./SentenceFeedbackList";
import { logStudyEvent } from "@/lib/events/study-events";
import { APP_ROUTES } from "@/lib/routes";
import { extractExternalFeedbackSupplement } from "@/lib/writing/external-feedback";
import { writingQuestionNeonClass } from "@/lib/writing/question-number-neon";
import { writingProblemHref } from "@/lib/writing/routes";
import type { FeedbackBundle, WritingSubmissionRow } from "@/lib/writing/types";

type ReportTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

type Props = {
  submission: WritingSubmissionRow;
  bundle: FeedbackBundle | null;
  withSentences: boolean;
  showSubmissionMeta?: boolean;
  showDimensionGrid?: boolean;
  dimensionCardLimit?: number;
  showDetailPanel?: boolean;
  retryLabelKey?: "retryDefault" | "retryWriting";
  reloadHref: string;
  userId: string;
  saveLocked?: boolean;
  alreadySaved?: boolean;
  canRetryProblem?: boolean;
  nextHref?: string;
};

export function FeedbackPageContent({
  submission,
  bundle,
  withSentences,
  showSubmissionMeta = false,
  showDimensionGrid = true,
  dimensionCardLimit,
  showDetailPanel = withSentences,
  retryLabelKey,
  reloadHref,
  userId,
  saveLocked = false,
  alreadySaved = false,
  canRetryProblem = true,
  nextHref = APP_ROUTES.practiceProblems,
}: Props) {
  const t = useTranslations("feedback.page");
  const tActions = useTranslations("feedback.actions");
  const tReport = useTranslations("feedback.report") as ReportTranslator;
  const router = useRouter();
  const status = submission.feedback_status;
  const reportTitle = tReport("title", { questionNo: submission.question_no });

  useEffect(() => {
    if (!bundle) return;
    void logStudyEvent({
      eventType: "feedback_viewed",
      problemId: submission.problem_id,
      submissionId: submission.id,
      payload: { question_no: submission.question_no },
    });
  }, [bundle, submission.id, submission.problem_id, submission.question_no]);

  if (!bundle) {
    return (
      <div className="flex min-h-full w-full flex-col bg-background">
        <ReportPageHeader
          testId="feedback-page-header"
          backHref={APP_ROUTES.library}
          backLabel={t("backToLibrary")}
          backTestId="feedback-header-back-link"
          title={
            <FeedbackReportTitle
              title={reportTitle}
              questionNo={submission.question_no}
            />
          }
          actions={null}
        />
        <div className="app-workspace-body app-workspace-body--workspace w-full px-4 py-6 sm:px-6">
          <Alert
            type={status === "failed" ? "error" : "info"}
            showIcon
            title={t("loadFailedTitle")}
            description={t("loadFailedDescription")}
          />
        </div>
      </div>
    );
  }

  const partial = bundle.feedback.status === "partial";
  const onReanalyze = () => router.refresh();
  const externalSupplement = extractExternalFeedbackSupplement(bundle.feedback);
  const retryHref = writingProblemHref({
    questionNo: submission.question_no,
    problemId: submission.problem_id,
    fresh: true,
    retrySubmissionId: submission.id,
    returnTo: reloadHref,
  });
  const showShortReportOverview =
    withSentences && !showDetailPanel && dimensionCardLimit === 4;
  const showReportOverview =
    showShortReportOverview ||
    (withSentences && showSubmissionMeta && showDimensionGrid === false);
  const showStickyReportHeader = withSentences;
  const defaultRetryLabelKey = showShortReportOverview
    ? "retryDefault"
    : withSentences
      ? "retryWriting"
      : "retryDefault";
  const resolvedRetryLabel = tActions(retryLabelKey ?? defaultRetryLabelKey);
  const retryDisabled = !canRetryProblem;
  const retryDisabledReason = retryDisabled
    ? tActions("retryUnavailable")
    : undefined;

  return (
    <div
      data-testid={showStickyReportHeader ? "feedback-page-shell" : undefined}
      className={
        showStickyReportHeader
          ? "flex min-h-full w-full flex-col bg-background"
          : "flex w-full flex-col"
      }
    >
      {showStickyReportHeader ? (
        <ReportPageHeader
          testId="feedback-page-header"
          backHref={APP_ROUTES.library}
          backLabel={t("backToLibrary")}
          backTestId="feedback-header-back-link"
          title={
            <FeedbackReportTitle
              title={reportTitle}
              questionNo={submission.question_no}
            />
          }
          actions={
            <FeedbackActionGroup
              key={submission.id}
              submissionId={submission.id}
              userId={userId}
              retryHref={retryHref}
              nextHref={nextHref}
              withPdf
              retryLabel={resolvedRetryLabel}
              saveLocked={saveLocked}
              alreadySaved={alreadySaved}
              retryDisabled={retryDisabled}
              retryDisabledReason={retryDisabledReason}
              variant="header"
            />
          }
        />
      ) : null}

      <div
        data-testid="feedback-page-body"
        className={
          showStickyReportHeader
            ? "app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-12 px-4 py-4 pb-32 sm:px-6 sm:py-6 sm:pb-40"
            : "flex w-full flex-col gap-12 pb-32 sm:pb-40"
        }
      >
        {partial ? (
          <Alert
            type="warning"
            showIcon
            title={t("partialTitle")}
            description={t("partialDescription")}
          />
        ) : null}

        {showReportOverview ? (
          <>
            {/* E-01 region 1: 점수/총평 요약. 53/54와 같은 상단 요약 구조를
                사용해 총평 점수, 문항 메타, 전체 설명을 모두 노출한다. */}
            <FeedbackSummary
              feedback={bundle.feedback}
              submission={submission}
            />
            <FeedbackReportOverview
              feedback={bundle.feedback}
              submission={submission}
              dimensions={bundle.dimensions}
              supplement={externalSupplement}
              retryHref={retryHref}
              retryLabel={resolvedRetryLabel}
              retryDisabled={retryDisabled}
              retryDisabledReason={retryDisabledReason}
              showCardHeader={!showStickyReportHeader}
            />
          </>
        ) : (
          <FeedbackSummary
            feedback={bundle.feedback}
            submission={showSubmissionMeta ? submission : undefined}
          />
        )}

        {showDimensionGrid && !showReportOverview ? (
          <DimensionCardGrid
            rows={bundle.dimensions}
            maxCards={dimensionCardLimit}
            onReanalyze={onReanalyze}
          />
        ) : null}

        {withSentences ? (
          <SentenceFeedbackList
            rows={bundle.sentences}
            onReanalyze={onReanalyze}
            questionNo={submission.question_no}
            answerText={submission.answer_text}
            answerJson={submission.answer_json}
          />
        ) : null}

        <FeedbackRecommendationCards
          dimensions={bundle.dimensions}
          retryHref={retryHref}
          retryDisabled={retryDisabled}
          supplement={externalSupplement}
        />

        {showDetailPanel ? (
          <DetailedFeedbackPanel dimensions={bundle.dimensions} />
        ) : null}

        {showStickyReportHeader ? null : (
          <NextActionBar
            key={submission.id}
            submissionId={submission.id}
            userId={userId}
            retryHref={retryHref}
            nextHref={nextHref}
            withPdf
            retryLabel={resolvedRetryLabel}
            saveLocked={saveLocked}
            alreadySaved={alreadySaved}
            retryDisabled={retryDisabled}
            retryDisabledReason={retryDisabledReason}
          />
        )}
      </div>
    </div>
  );
}

function FeedbackReportTitle({
  title,
  questionNo,
}: {
  title: string;
  questionNo: number;
}) {
  const questionNoText = String(questionNo);
  const index = title.indexOf(questionNoText);

  if (index === -1) {
    return <span data-testid="feedback-title">{title}</span>;
  }

  return (
    <span
      data-testid="feedback-title"
      className="inline-flex items-center whitespace-nowrap"
    >
      <span className="sr-only">{title}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {title.slice(0, index)}
        <span
          data-testid="feedback-title-question-no"
          className={[
            "writing-question-number font-['Space_Grotesk'] leading-none",
            writingQuestionNeonClass("writing-question-number", questionNo),
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {questionNoText}
        </span>
        {title.slice(index + questionNoText.length)}
      </span>
    </span>
  );
}
