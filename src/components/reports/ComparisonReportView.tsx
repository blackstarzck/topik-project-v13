"use client";

import { Alert, App, Button, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import {
  DocumentTextIcon,
  ProgrammingArrowsIcon,
  RefreshCcw,
} from "@/components/shared/AppIcons";
import { ReportPageHeader } from "@/components/shared/ReportPageHeader";
import { logStudyEvent } from "@/lib/events/study-events";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";
import type { ComparisonTargetCandidate } from "@/lib/writing/server";
import { ComparisonKpiBlock } from "./ComparisonKpiBlock";
import { ComparisonTargetDrawer } from "./ComparisonTargetDrawer";
import { DimensionComparisonCards } from "./DimensionComparisonCards";
import { ScoreComparisonChart, type ChartDatum } from "./ScoreComparisonChart";
import { SubmissionDiffPanel } from "./SubmissionDiffPanel";

const { Paragraph, Text } = Typography;

type NavigationAction = "next" | "weakness" | "retry";

type Props = {
  metrics: ComparisonMetrics;
  narrative: string | null;
  currentText: string;
  previousText: string | null;
  retryHref?: string | null;
  reportId: string;
  currentScore: number | null;
  chartData: ChartDatum[];
  currentNorm: Record<string, number | null>;
  hasPrevious: boolean;
  currentSubmissionId: string;
  currentQuestionNo: number;
  currentSubmittedAt: string;
  selectedPreviousSubmissionId: string | null;
  comparisonTargets: ComparisonTargetCandidate[];
};

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

export function ComparisonReportView({
  metrics,
  narrative,
  currentText,
  previousText,
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
}: Props) {
  const t = useTranslations("reports.comparison");
  const router = useRouter();
  const { notification } = App.useApp();
  const [sharing, setSharing] = useState(false);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null,
  );
  const [targetDrawerOpen, setTargetDrawerOpen] = useState(false);

  useEffect(() => {
    void logStudyEvent({
      eventType: "report_viewed",
      payload: { report_id: reportId },
    });
  }, [reportId]);

  const changedDimensions = Object.values(metrics.dimension_deltas).filter(
    (delta) => delta !== null && Math.abs(delta) >= 1,
  ).length;

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
    setPendingAction(action);
    router.push(href);
  }

  return (
    <div
      data-testid="comparison-page-shell"
      className="relative flex min-h-full w-full flex-col overflow-x-hidden bg-background"
    >
      <ReportPageHeader
        testId="comparison-page-header"
        title={t("heading")}
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
                  onClick={onShare}
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
        className="app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6"
      >
        <AppCard
          data-testid="comparison-summary-strip"
          className="comparison-summary-strip"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <DocumentTextIcon aria-hidden size={20} />
              </span>
              <div className="min-w-0">
                <Text type="secondary" className="block text-xs">
                  {t("currentAnswerLabel")}
                </Text>
                <Text strong className="block truncate">
                  {t("questionTitle", { questionNo: currentQuestionNo })}
                </Text>
                <Text type="secondary" className="block text-xs">
                  {t("submittedAt", { date: currentSubmittedLabel })}
                </Text>
              </div>
              <Text strong className="ml-auto text-3xl">
                {currentScore === null
                  ? t("targetDrawerNoScore")
                  : t("targetDrawerScore", { score: currentScore })}
              </Text>
            </div>

            <ProgrammingArrowsIcon
              aria-hidden
              size={24}
              className="hidden text-secondary lg:block"
            />

            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <DocumentTextIcon aria-hidden size={20} />
              </span>
              <div className="min-w-0">
                <Text type="secondary" className="block text-xs">
                  {t("compareTargetLabel")}
                </Text>
                <Text strong className="block truncate">
                  {selectedTarget
                    ? t("previousQuestionTitle", {
                        questionNo: selectedTarget.questionNo,
                      })
                    : t("noCompareTarget")}
                </Text>
                <Text type="secondary" className="block text-xs">
                  {previousSubmittedLabel
                    ? t("submittedAt", { date: previousSubmittedLabel })
                    : t("targetDrawerEmpty")}
                </Text>
              </div>
              <Text strong className="ml-auto text-3xl">
                {previousScore === null
                  ? t("targetDrawerNoScore")
                  : t("targetDrawerScore", { score: previousScore })}
              </Text>
            </div>

            <Button
              icon={<RefreshCcw aria-hidden size={16} />}
              onClick={() => setTargetDrawerOpen(true)}
              data-testid="comparison-action-change-target"
              className="lg:justify-self-end"
            >
              {t("changeTarget")}
            </Button>
          </div>
        </AppCard>

        <ComparisonKpiBlock
          currentScore={currentScore}
          scoreDelta={metrics.score_delta}
          changedDimensions={changedDimensions}
          hasPrevious={hasPrevious}
        />

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
              <Paragraph className="mb-2" ellipsis={{ rows: 3 }}>
                {narrative}
              </Paragraph>
              <Text type="secondary">{t("narrativeDisclaimer")}</Text>
            </>
          )}
        </AppCard>

        <ScoreComparisonChart data={chartData} hasPrevious={hasPrevious} />

        <DimensionComparisonCards
          deltas={metrics.dimension_deltas}
          hasPrevious={hasPrevious}
          currentScores={currentNorm}
        />

        <SubmissionDiffPanel
          currentText={currentText}
          previousText={previousText}
        />
      </div>

      <ComparisonTargetDrawer
        open={targetDrawerOpen}
        onClose={() => setTargetDrawerOpen(false)}
        currentSubmissionId={currentSubmissionId}
        currentQuestionNo={currentQuestionNo}
        selectedPreviousSubmissionId={selectedPreviousSubmissionId}
        candidates={comparisonTargets}
      />
    </div>
  );
}
