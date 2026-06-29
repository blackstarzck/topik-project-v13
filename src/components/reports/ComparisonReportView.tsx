"use client";

import { Alert, App, Button, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { ReportPageHeader } from "@/components/shared/ReportPageHeader";
import { logStudyEvent } from "@/lib/events/study-events";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";
import { ComparisonKpiBlock } from "./ComparisonKpiBlock";
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
};

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
}: Props) {
  const t = useTranslations("reports.comparison");
  const router = useRouter();
  const { notification } = App.useApp();
  const [sharing, setSharing] = useState(false);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null,
  );

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

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: t("shareTitle"), url });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
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
      className="flex min-h-full w-full flex-col bg-background"
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
                className="feedback-action-divider flex w-full flex-wrap items-center gap-2 pt-2 md:ml-1 md:w-auto md:pl-3 md:pt-0"
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
        className="app-workspace-body app-workspace-body--workspace flex w-full flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6"
      >
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
    </div>
  );
}
