"use client";

import { Alert, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { DetailedFeedbackPanel } from "./DetailedFeedbackPanel";
import { DimensionCardGrid } from "./DimensionCardGrid";
import { FeedbackPendingPanel } from "./FeedbackPendingPanel";
import { FeedbackRecommendationCards } from "./FeedbackRecommendationCards";
import { FeedbackReportOverview } from "./FeedbackReportOverview";
import { FeedbackSummary } from "./FeedbackSummary";
import { FeedbackActionGroup, NextActionBar } from "./NextActionBar";
import { SentenceFeedbackList } from "./SentenceFeedbackList";
import { extractExternalFeedbackSupplement } from "@/lib/writing/external-feedback";
import { writingProblemHref } from "@/lib/writing/routes";
import type { FeedbackBundle, WritingSubmissionRow } from "@/lib/writing/types";

const { Text, Title } = Typography;

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
}: Props) {
  const t = useTranslations("feedback.page");
  const tActions = useTranslations("feedback.actions");
  const tReport = useTranslations("feedback.report") as ReportTranslator;
  const router = useRouter();
  const status = submission.feedback_status;

  if ((status === "pending" || status === "analyzing") && !bundle) {
    return (
      <FeedbackPendingPanel
        submissionId={submission.id}
        reloadHref={reloadHref}
        initialStatus={status}
        submission={submission}
      />
    );
  }

  if (status === "failed" && !bundle) {
    return (
      <FeedbackPendingPanel
        submissionId={submission.id}
        reloadHref={reloadHref}
        initialStatus="failed"
        submission={submission}
      />
    );
  }

  if (!bundle) {
    return (
      <Alert
        type="info"
        showIcon
        title={t("loadFailedTitle")}
        description={t("loadFailedDescription")}
      />
    );
  }

  const partial = bundle.feedback.status === "partial";
  const onReanalyze = () => router.refresh();
  const externalSupplement = extractExternalFeedbackSupplement(bundle.feedback);
  const retryHref = writingProblemHref({
    questionNo: submission.question_no,
    problemId: submission.problem_id,
  });
  const showShortReportOverview =
    withSentences && !showDetailPanel && dimensionCardLimit === 4;
  const showStickyReportHeader = showShortReportOverview;
  const resolvedRetryLabel = tActions(
    retryLabelKey ?? (withSentences ? "retryWriting" : "retryDefault"),
  );

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
        <div
          data-testid="feedback-page-header"
          className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
        >
          <div className="flex w-full flex-col gap-3 px-4 py-4 pr-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:pr-20">
            <div className="min-w-0">
              <Title level={3} className="m-0 text-2xl">
                {tReport("title", { questionNo: submission.question_no })}
              </Title>
              <Text type="secondary" className="block">
                {tReport("subtitle")}
              </Text>
            </div>
            <FeedbackActionGroup
              submissionId={submission.id}
              userId={userId}
              retryHref={retryHref}
              nextHref="/practice/next"
              withPdf
              retryLabel={resolvedRetryLabel}
              saveLocked={saveLocked}
              variant="header"
              className="shrink-0"
            />
          </div>
        </div>
      ) : null}

      <div
        className={
          showStickyReportHeader
            ? "flex w-full flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6"
            : "flex w-full flex-col gap-6"
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

        {showShortReportOverview ? (
          <>
            {/* E-01 region 1: 점수/총평 요약. 53/54와 동일한 FeedbackSummary를
                재사용하되, 점수는 아래 리포트 카드에서 강조되므로 hideScore로 총평만 노출. */}
            <FeedbackSummary feedback={bundle.feedback} hideScore />
            <FeedbackReportOverview
              feedback={bundle.feedback}
              submission={submission}
              dimensions={bundle.dimensions}
              supplement={externalSupplement}
              retryHref={retryHref}
              retryLabel={resolvedRetryLabel}
              showCardHeader={!showStickyReportHeader}
            />
          </>
        ) : (
          <FeedbackSummary
            feedback={bundle.feedback}
            submission={showSubmissionMeta ? submission : undefined}
          />
        )}

        {showDimensionGrid && !showShortReportOverview ? (
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
          />
        ) : null}

        {showDetailPanel ? (
          <DetailedFeedbackPanel dimensions={bundle.dimensions} />
        ) : null}

        <FeedbackRecommendationCards
          dimensions={bundle.dimensions}
          retryHref={retryHref}
          supplement={externalSupplement}
        />

        {showStickyReportHeader ? null : (
          <NextActionBar
            submissionId={submission.id}
            userId={userId}
            retryHref={retryHref}
            nextHref="/practice/next"
            withPdf
            retryLabel={resolvedRetryLabel}
            saveLocked={saveLocked}
          />
        )}
      </div>
    </div>
  );
}
