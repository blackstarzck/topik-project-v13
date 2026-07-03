"use client";

import { Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type { LibraryDashboardKpis } from "@/lib/library/types";

import {
  formatDashboardInactiveDuration,
  formatDashboardMonthDay,
} from "./library-dashboard-format";

const { Text } = Typography;

type Props = {
  kpis: LibraryDashboardKpis;
};

export function LibraryKpiStrip({ kpis }: Props) {
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
        <AppCard key={item.key} size="small" data-testid="library-kpi-card">
          <div
            data-testid={`library-kpi-card-${item.key}`}
            className="flex min-h-[72px] items-center"
          >
            <span className="min-w-0 flex-1">
              <Text className="block text-sm">{item.label}</Text>
              <Text
                strong
                data-testid="library-kpi-value"
                className="block !text-[24px] !leading-tight"
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
                  className="block !text-[24px] !leading-tight"
                >
                  {t("kpi.inactiveSince", { duration: inactiveDuration })}
                </Text>
              </>
            ) : (
              <Text strong className="block !text-[24px] !leading-tight">
                {t("kpi.noRecentStudy")}
              </Text>
            )}
          </span>
        </div>
      </AppCard>
    </div>
  );
}
