"use client";

import { Empty, Statistic, Typography } from "antd";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  ChartNoAxesColumnIncreasing,
  Trophy,
} from "@/components/shared/AppIcons";
import { AppCard } from "@/components/shared/AppCard";

const { Text } = Typography;

type Props = {
  currentScore: number | null;
  scoreDelta: number | null;
  changedDimensions: number;
  hasPrevious: boolean;
};

export function ComparisonKpiBlock({
  currentScore,
  scoreDelta,
  changedDimensions,
  hasPrevious,
}: Props) {
  const t = useTranslations("reports.kpi");

  if (currentScore === null) {
    return (
      <AppCard
        data-testid="comparison-kpi-block"
        className="comparison-kpi-block"
      >
        <Empty description={t("emptyScore")} />
      </AppCard>
    );
  }

  return (
    <div
      data-testid="comparison-kpi-block"
      className="comparison-kpi-block grid grid-cols-1 gap-3 md:grid-cols-3"
    >
      <AppCard data-testid="comparison-kpi-item" className="h-full">
        <div className="flex items-center justify-between gap-3">
          <Statistic
            title={t("currentTotal")}
            value={currentScore}
            suffix={t("suffixPoint")}
          />
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--app-color-bg-layout)] text-primary">
            <Trophy aria-hidden size={22} />
          </span>
        </div>
      </AppCard>
      <AppCard data-testid="comparison-kpi-item" className="h-full">
        <div className="flex items-center justify-between gap-3">
          {hasPrevious && scoreDelta !== null ? (
            <Statistic
              title={t("improvement")}
              value={Math.abs(scoreDelta)}
              precision={1}
              prefix={
                <span aria-hidden>
                  {scoreDelta > 0 ? "+" : scoreDelta < 0 ? "-" : "="}
                </span>
              }
              suffix={t("suffixPoint")}
            />
          ) : (
            <Statistic
              title={t("improvement")}
              value={0}
              formatter={() => (
                <Text type="secondary" className="text-lg">
                  {t("noComparison")}
                </Text>
              )}
            />
          )}
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--app-color-bg-layout)] text-primary">
            <ChartNoAxesColumnIncreasing aria-hidden size={22} />
          </span>
        </div>
      </AppCard>
      <AppCard data-testid="comparison-kpi-item" className="h-full">
        <div className="flex items-center justify-between gap-3">
          <Statistic
            title={t("changedDimensions")}
            value={hasPrevious ? changedDimensions : 0}
            suffix={hasPrevious ? t("suffixCount") : ""}
            formatter={
              hasPrevious
                ? undefined
                : () => (
                    <Text type="secondary" className="text-lg">
                      {t("singleResult")}
                    </Text>
                  )
            }
          />
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--app-color-bg-layout)] text-primary">
            <BarChart3 aria-hidden size={22} />
          </span>
        </div>
      </AppCard>
    </div>
  );
}
