"use client";

import { Alert, App, Button, Tooltip, Typography } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { AiCommentaryIcon, RefreshCcw } from "@/components/shared/AppIcons";
import { ReportPageHeader } from "@/components/shared/ReportPageHeader";
import { trackButtonClick } from "@/lib/analytics/google-analytics";
import { logStudyEvent } from "@/lib/events/study-events";
import type { ComparisonReportViewModel } from "@/lib/writing/comparison-report-view-model";
import { writingQuestionNeonClass } from "@/lib/writing/question-number-neon";
import { BlankTraitComparisonPanel } from "./BlankTraitComparisonPanel";
import { ComparisonTargetDrawer } from "./ComparisonTargetDrawer";
import { DimensionComparisonCards } from "./DimensionComparisonCards";
import { ScoreComparisonChart } from "./ScoreComparisonChart";
import { SubmissionDiffPanel } from "./SubmissionDiffPanel";

const { Paragraph, Text } = Typography;

type NavigationAction = "next" | "weakness" | "retry";

type OptionalReportField =
  | "showBlankComparison"
  | "hasBlankTraitData"
  | "blankComparisons";

type Props = Omit<ComparisonReportViewModel, OptionalReportField> &
  Partial<Pick<ComparisonReportViewModel, OptionalReportField>>;

function normalizeReport(
  report: Props | ComparisonReportViewModel,
): ComparisonReportViewModel {
  return {
    ...report,
    showBlankComparison: report.showBlankComparison ?? false,
    hasBlankTraitData: report.hasBlankTraitData ?? false,
    blankComparisons: report.blankComparisons ?? [],
  };
}

function normalizedScore(score: number | null, scoreMax: number | null) {
  if (score === null) return null;
  const max = scoreMax && scoreMax > 0 ? scoreMax : 100;
  return Math.round((score / max) * 1000) / 10;
}

function formatSubmittedAt(value: string) {
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return value;
  const kst = new Date(time + 9 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    `${kst.getUTCFullYear()}.${pad(kst.getUTCMonth() + 1)}.${pad(kst.getUTCDate())}`,
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`,
  ].join(" ");
}

export function ComparisonReportView(initialReport: Props) {
  const t = useTranslations("reports.comparison");
  const router = useRouter();
  const { notification } = App.useApp();
  const [activeReport, setActiveReport] = useState<ComparisonReportViewModel>(
    () => normalizeReport(initialReport),
  );
  const [sharing, setSharing] = useState(false);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null,
  );
  const [targetDrawerOpen, setTargetDrawerOpen] = useState(false);
  const {
    metrics,
    narrative,
    currentText,
    previousText,
    currentAnswerJson,
    previousAnswerJson,
    retryHref,
    reportId,
    currentScore,
    chartData,
    currentNorm,
    hasPrevious,
    currentSubmissionId,
    currentQuestionNo,
    currentSubmittedAt,
    selectedPreviousSubmissionId,
    comparisonTargets,
    showBlankComparison,
    hasBlankTraitData,
    blankComparisons,
  } = activeReport;

  useEffect(() => {
    void logStudyEvent({
      eventType: "report_viewed",
      submissionId: currentSubmissionId,
      payload: { report_id: reportId },
    });
  }, [currentSubmissionId, reportId]);

  const narrativeFailed = !narrative || narrative.trim().length === 0;
  const weaknessDisabled = !hasPrevious;
  const selectedTarget =
    comparisonTargets.find(
      (candidate) => candidate.submissionId === selectedPreviousSubmissionId,
    ) ??
    comparisonTargets.find((candidate) => candidate.isSelected) ??
    null;
  const previousScore = selectedTarget
    ? normalizedScore(selectedTarget.score, selectedTarget.scoreMax)
    : null;
  const currentSubmittedLabel = formatSubmittedAt(currentSubmittedAt);
  const previousSubmittedLabel = selectedTarget
    ? formatSubmittedAt(selectedTarget.submittedAt)
    : null;
  const reportTitle = t("title", { questionNo: currentQuestionNo });

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: t("shareTitle"), url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        notification.success({ title: t("shareCopied") });
      } else {
        notification.info({
          title: t("shareLink"),
          description: url,
        });
      }
    } catch {
      // Sharing cancellation should not interrupt report reading.
    } finally {
      setSharing(false);
    }
  }

  function navigateOnce(action: NavigationAction, href: string) {
    if (pendingAction) return;
    trackButtonClick({
      buttonId: `comparison_${action}`,
      surface: "comparison_report",
      questionNo: currentQuestionNo,
    });
    setPendingAction(action);
    router.push(href);
  }

  function handleComparisonReportLoaded(viewModel: ComparisonReportViewModel) {
    setActiveReport(viewModel);
    setTargetDrawerOpen(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `/writing/reports/${viewModel.reportId}/compare`,
      );
    }
  }

  return (
    <div
      data-testid="comparison-page-shell"
      className="relative flex min-h-full w-full flex-col overflow-x-hidden bg-background"
    >
      <ReportPageHeader
        testId="comparison-page-header"
        title={
          <ComparisonReportTitle
            questionNo={currentQuestionNo}
            title={reportTitle}
          />
        }
        actions={
          <div
            data-testid="comparison-next-actions"
            className="feedback-actions flex w-full justify-start lg:w-auto lg:justify-end"
          >
            <div
              data-testid="comparison-next-actions-controls"
              className="flex w-full flex-wrap items-center gap-2 lg:justify-end"
            >
              {retryHref ? (
                <Button
                  onClick={() => navigateOnce("retry", retryHref)}
                  loading={pendingAction === "retry"}
                  disabled={pendingAction !== null && pendingAction !== "retry"}
                  data-testid="comparison-action-retry"
                >
                  {t("retryProblem")}
                </Button>
              ) : null}
              <div
                data-testid="comparison-next-actions-secondary"
                className="flex w-full flex-wrap items-center gap-2 md:w-auto"
              >
                <Button
                  type="primary"
                  onClick={() => navigateOnce("next", "/practice/next")}
                  loading={pendingAction === "next"}
                  disabled={pendingAction !== null && pendingAction !== "next"}
                  data-testid="comparison-action-next"
                >
                  {t("nextProblem")}
                </Button>
                {weaknessDisabled ? (
                  <Tooltip title={t("weaknessDisabledTooltip")}>
                    <Button disabled data-testid="comparison-action-weakness">
                      {t("weaknessDisabled")}
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    onClick={() =>
                      navigateOnce("weakness", "/practice/weakness")
                    }
                    loading={pendingAction === "weakness"}
                    disabled={
                      pendingAction !== null && pendingAction !== "weakness"
                    }
                    data-testid="comparison-action-weakness"
                  >
                    {t("weaknessView")}
                  </Button>
                )}
                <Button
                  onClick={() => {
                    trackButtonClick({
                      buttonId: "comparison_share",
                      surface: "comparison_report",
                      questionNo: currentQuestionNo,
                    });
                    void onShare();
                  }}
                  loading={sharing}
                  data-testid="comparison-action-share"
                >
                  {t("share")}
                </Button>
              </div>
            </div>
          </div>
        }
      />

      <div
        data-testid="comparison-page-body"
        className="app-workspace-body app-workspace-body--workspace app-cards-bordered comparison-report-body flex w-full flex-col gap-20 px-4 pt-[100px] pb-32 sm:px-6 sm:pb-40"
      >
        <section
          data-testid="comparison-summary-strip"
          className="comparison-summary-strip min-w-0 overflow-hidden py-2"
        >
          <div
            data-testid="comparison-summary-answer-row"
            className="grid gap-10 xl:grid-cols-2 xl:gap-16"
          >
            <SummaryAnswerBlock
              label={t("currentAnswerLabel")}
              submittedAt={t("submittedAt", { date: currentSubmittedLabel })}
              score={
                currentScore === null
                  ? t("targetDrawerNoScore")
                  : t("targetDrawerScore", { score: currentScore })
              }
            />

            <SummaryAnswerBlock
              label={t("compareTargetLabel")}
              submittedAt={
                previousSubmittedLabel
                  ? t("submittedAt", { date: previousSubmittedLabel })
                  : t("targetDrawerEmpty")
              }
              score={
                previousScore === null
                  ? t("targetDrawerNoScore")
                  : t("targetDrawerScore", { score: previousScore })
              }
              action={
                <Tooltip title={t("changeTarget")}>
                  <Button
                    aria-label={t("changeTarget")}
                    icon={<RefreshCcw aria-hidden size={16} />}
                    onClick={() => setTargetDrawerOpen(true)}
                    data-testid="comparison-action-change-target"
                    className="shrink-0"
                  />
                </Tooltip>
              }
            />
          </div>
        </section>

        <AppCard data-testid="comparison-narrative">
          {narrativeFailed ? (
            <Alert
              type="warning"
              showIcon
              message={t("narrativeFailedTitle")}
              description={t("narrativeFailedDescription")}
              action={
                <Button size="small" onClick={() => router.refresh()}>
                  {t("retry")}
                </Button>
              }
            />
          ) : (
            <>
              <div
                className="flex items-center gap-3"
                data-testid="comparison-narrative-summary-row"
              >
                <AiCommentaryIcon
                  aria-hidden
                  data-testid="comparison-narrative-summary-icon"
                  size={32}
                  className="shrink-0 text-text-primary"
                />
                <div
                  data-testid="comparison-narrative-summary-group"
                  className="min-w-0"
                >
                  <Paragraph
                    className="min-w-0 !mb-[10px] !text-[20px] font-semibold leading-8"
                    data-testid="comparison-narrative-summary"
                    ellipsis={{ rows: 3 }}
                  >
                    {narrative}
                  </Paragraph>
                  <Text
                    type="secondary"
                    className="block text-sm"
                    data-testid="comparison-narrative-disclaimer"
                  >
                    {t("narrativeDisclaimer")}
                  </Text>
                </div>
              </div>
            </>
          )}
        </AppCard>

        {showBlankComparison ? (
          <BlankTraitComparisonPanel
            items={blankComparisons}
            hasPrevious={hasPrevious}
            hasTraitData={hasBlankTraitData}
          />
        ) : (
          <>
            <ScoreComparisonChart data={chartData} hasPrevious={hasPrevious} />

            <DimensionComparisonCards
              deltas={metrics.dimension_deltas}
              hasPrevious={hasPrevious}
              currentScores={currentNorm}
            />
          </>
        )}

        {!showBlankComparison ? (
          <SubmissionDiffPanel
            currentText={currentText}
            previousText={previousText}
            currentAnswerJson={currentAnswerJson}
            previousAnswerJson={previousAnswerJson}
          />
        ) : null}
      </div>

      <ComparisonTargetDrawer
        open={targetDrawerOpen}
        onClose={() => setTargetDrawerOpen(false)}
        currentSubmissionId={currentSubmissionId}
        currentQuestionNo={currentQuestionNo}
        selectedPreviousSubmissionId={selectedPreviousSubmissionId}
        candidates={comparisonTargets}
        onComparisonReportLoaded={handleComparisonReportLoaded}
      />
    </div>
  );
}

function ComparisonReportTitle({
  questionNo,
  title,
}: {
  questionNo: number;
  title: string;
}) {
  const questionNoText = String(questionNo);
  const index = title.indexOf(questionNoText);

  if (index === -1) {
    return <span data-testid="comparison-title">{title}</span>;
  }

  return (
    <span
      data-testid="comparison-title"
      className="inline-flex items-center whitespace-nowrap"
    >
      <span className="sr-only">{title}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {title.slice(0, index)}
        <span
          data-testid="comparison-title-question-no"
          className={[
            "writing-question-number font-['Space_Grotesk'] leading-none",
            writingQuestionNeonClass("writing-question-number", questionNo),
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {questionNoText}
        </span>
        <span data-testid="comparison-title-label">
          {title.slice(index + questionNoText.length)}
        </span>
      </span>
    </span>
  );
}

function SummaryAnswerBlock({
  label,
  submittedAt,
  score,
  action,
}: {
  label: string;
  submittedAt: string;
  score: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-testid="comparison-summary-answer-card"
      className="flex min-w-0 w-full flex-col items-start px-6 py-8"
    >
      <Text
        type="secondary"
        data-testid="comparison-summary-label"
        className="block !text-[16px]"
      >
        {label}
      </Text>
      <div
        data-testid="comparison-summary-score-row"
        className="mt-2 flex items-center gap-3"
      >
        <Text
          strong
          data-testid="comparison-summary-score"
          className="block !text-[46px] leading-none"
        >
          {score}
        </Text>
        {action}
      </div>
      <Text
        type="secondary"
        data-testid="comparison-summary-submitted-at"
        className="mt-2 block !text-[14px]"
      >
        {submittedAt}
      </Text>
    </div>
  );
}
