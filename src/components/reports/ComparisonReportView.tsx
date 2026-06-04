"use client";

import { Alert, Button, Space, Tooltip, Typography, notification } from "antd";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/shared/AppCard";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";
import { logStudyEvent } from "@/lib/events/study-events";
import { ComparisonKpiBlock } from "./ComparisonKpiBlock";
import { DimensionComparisonCards } from "./DimensionComparisonCards";
import { ScoreComparisonChart, type ChartDatum } from "./ScoreComparisonChart";
import { SubmissionDiffPanel } from "./SubmissionDiffPanel";

const { Paragraph, Text, Title } = Typography;

type Props = {
  metrics: ComparisonMetrics;
  narrative: string | null;
  currentText: string;
  previousText: string | null;
  retryHref?: string | null;
  reportId: string;
  currentScore: number | null;
  chartData: ChartDatum[];
  /** dimension → 현재 0..100 정규화 점수. 이전 없을 때 카드에 사용. */
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
  const [sharing, setSharing] = useState(false);

  // 리포트 조회 이벤트 (functional-spec study_events report_viewed).
  useEffect(() => {
    void logStudyEvent({
      eventType: "report_viewed",
      payload: { report_id: reportId },
    });
  }, [reportId]);

  const changedDimensions = Object.values(metrics.dimension_deltas).filter(
    (d) => d !== null && Math.abs(d) >= 1,
  ).length;

  // description region 4 예외 — 분석 생성 실패 시 핵심 지표만 남기고 재시도 제공.
  const narrativeFailed = !narrative || narrative.trim().length === 0;

  // description region 5 예외 — 추천 없음/권한 잠금은 비활성 CTA와 사유 표시.
  // 약점 추천은 비교 데이터가 있을 때만 의미가 있으므로 단일 결과면 비활성.
  const weaknessDisabled = !hasPrevious;

  async function onShare() {
    if (sharing) return; // 중복 클릭 차단
    setSharing(true);
    try {
      const url =
        typeof window !== "undefined" ? window.location.href : "";
      // 외부 공유 채널 연동 예정 — 우선 OS 공유 시트/클립보드로 정직하게 처리.
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: t("shareTitle"), url });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(url);
        notification.success({ message: t("shareCopied") });
      } else {
        notification.info({
          message: t("shareLink"),
          description: url,
        });
      }
    } catch {
      // 사용자가 공유 취소 — 조용히 무시.
    } finally {
      setSharing(false);
    }
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title level={4} style={{ margin: 0 }}>
          {t("heading")}
        </Title>
        <Button onClick={onShare} loading={sharing}>
          {t("share")}
        </Button>
      </div>

      {/* region 1 — 비교 KPI. */}
      <ComparisonKpiBlock
        currentScore={currentScore}
        scoreDelta={metrics.score_delta}
        changedDimensions={changedDimensions}
        hasPrevious={hasPrevious}
      />

      {/* region 4 — 분석 요약 (3줄 이하 + 실패 폴백). */}
      <AppCard>
        {narrativeFailed ? (
          <Alert
            type="warning"
            showIcon
            title={t("narrativeFailedTitle")}
            description={t("narrativeFailedDescription")}
            action={
              <Button size="small" onClick={() => router.refresh()}>
                {t("retry")}
              </Button>
            }
          />
        ) : (
          <>
            {/* narrative 본문은 comparison-service.generateNarrative()가
                생성하는 서비스 계층 문구라 여기서 외부화하지 않는다. */}
            <Paragraph style={{ marginBottom: 8 }} ellipsis={{ rows: 3 }}>
              {narrative}
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("narrativeDisclaimer")}
            </Text>
          </>
        )}
      </AppCard>

      {/* region 2 — 점수 그래프 (recharts + 표 폴백). */}
      <ScoreComparisonChart data={chartData} hasPrevious={hasPrevious} />

      {/* region 3 — 항목별 비교 카드 (상승/하락/유지, 4개 이하). */}
      <DimensionComparisonCards
        deltas={metrics.dimension_deltas}
        hasPrevious={hasPrevious}
        currentScores={currentNorm}
      />

      <SubmissionDiffPanel currentText={currentText} previousText={previousText} />

      {/* region 5 — 다음 CTA (대표 CTA 1개 + 후속 학습 경로, 중복 클릭 차단). */}
      <AppCard>
        <Title level={5} style={{ marginTop: 0 }}>
          {t("nextLearningTitle")}
        </Title>
        <Space wrap>
          <Button type="primary" onClick={() => router.push("/practice/next")}>
            {t("nextProblem")}
          </Button>
          {weaknessDisabled ? (
            <Tooltip title={t("weaknessDisabledTooltip")}>
              <Button disabled>{t("weaknessDisabled")}</Button>
            </Tooltip>
          ) : (
            <Button onClick={() => router.push("/practice/weakness")}>
              {t("weaknessView")}
            </Button>
          )}
          {retryHref ? (
            <Button onClick={() => router.push(retryHref)}>{t("retryProblem")}</Button>
          ) : null}
        </Space>
      </AppCard>
    </Space>
  );
}
