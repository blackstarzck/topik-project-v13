"use client";

import { Button, Tooltip, Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import { RefreshCcw } from "@/components/shared/AppIcons";
import type { LibraryDashboardKpis } from "@/lib/library/types";

import {
  formatDashboardInactiveDuration,
  formatDashboardMonthDay,
} from "./library-dashboard-format";
import typographyStyles from "./LibraryTypography.module.css";

const { Text } = Typography;

type Props = {
  kpis: LibraryDashboardKpis;
  feedbackWaitingRefresh?: {
    canRefresh: boolean;
    isRefreshing: boolean;
    onRefresh: () => void;
  };
};

export function LibraryKpiStrip({ kpis, feedbackWaitingRefresh }: Props) {
  const t = useTranslations("library.dashboard");
  const locale = useLocale();
  const numberFormat = new Intl.NumberFormat(locale);
  const countItems = [
    {
      key: "reviewable",
      label: t("kpi.reviewable"),
      value: numberFormat.format(kpis.reviewableCount),
    },
    {
      key: "feedbackWaiting",
      label: t("kpi.feedbackWaiting"),
      value: numberFormat.format(kpis.feedbackWaitingCount),
    },
    {
      key: "comparison",
      label: t("kpi.comparison"),
      value: numberFormat.format(kpis.comparisonAvailableCount),
    },
  ];
  const recentStudyDate = formatDashboardMonthDay(
    kpis.recentSubmissionDate,
    locale,
  );
  const inactiveDuration = formatDashboardInactiveDuration(
    kpis.recentSubmissionDate,
    locale,
  );

  return (
    <div data-testid="library-kpi-strip" className="grid gap-4 lg:grid-cols-4">
      {countItems.map((item) => (
        <AppCard
          key={item.key}
          size="small"
          data-testid="library-kpi-card"
          title={<Text className="block text-sm">{item.label}</Text>}
          extra={
            item.key === "feedbackWaiting" && feedbackWaitingRefresh ? (
              <Tooltip title={t("waiting.refreshTooltip")}>
                <Button
                  type="text"
                  aria-label={t("waiting.refreshAria")}
                  data-testid="library-kpi-feedbackWaiting-refresh"
                  icon={<RefreshCcw aria-hidden size={16} />}
                  loading={feedbackWaitingRefresh.isRefreshing}
                  disabled={
                    feedbackWaitingRefresh.isRefreshing ||
                    !feedbackWaitingRefresh.canRefresh
                  }
                  onClick={() => {
                    feedbackWaitingRefresh.onRefresh();
                  }}
                />
              </Tooltip>
            ) : null
          }
        >
          <div
            data-testid={`library-kpi-card-${item.key}`}
            className="flex min-h-[40px] items-center"
          >
            <span className="min-w-0 flex-1">
              <Text
                strong
                data-testid="library-kpi-value"
                className={`block !leading-tight ${typographyStyles.kpiValue}`}
              >
                {item.value}
              </Text>
            </span>
          </div>
        </AppCard>
      ))}
      <AppCard size="small" data-testid="library-kpi-card">
        <div
          data-testid="library-kpi-card-recentStudy"
          className="flex min-h-[72px] items-center"
        >
          <span className="min-w-0 flex-1">
            {recentStudyDate && inactiveDuration ? (
              <>
                <Text className="block text-sm">
                  {t("kpi.recentStudyDate", { date: recentStudyDate })}
                </Text>
                <Text
                  strong
                  data-testid="library-kpi-recent-inactive-duration"
                  className={`block !leading-tight ${typographyStyles.kpiValue}`}
                >
                  {t("kpi.inactiveSince", { duration: inactiveDuration })}
                </Text>
              </>
            ) : (
              <Text
                strong
                className={`block !leading-tight ${typographyStyles.kpiValue}`}
              >
                {t("kpi.noRecentStudy")}
              </Text>
            )}
          </span>
        </div>
      </AppCard>
    </div>
  );
}
