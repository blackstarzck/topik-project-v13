"use client";

import { Typography } from "antd";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Link2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type { LibraryDashboardKpis } from "@/lib/library/types";

import { formatDashboardMonthDay } from "./library-dashboard-format";

const { Text } = Typography;

type Props = {
  kpis: LibraryDashboardKpis;
};

export function LibraryKpiStrip({ kpis }: Props) {
  const t = useTranslations("library.dashboard");
  const locale = useLocale();
  const items = [
    {
      key: "reviewable",
      label: t("kpi.reviewable"),
      value: t("kpi.count", { count: kpis.reviewableCount }),
      description: t("kpi.reviewableDescription"),
      icon: CheckCircle2,
      tone: "library-kpi-icon--primary",
    },
    {
      key: "feedbackWaiting",
      label: t("kpi.feedbackWaiting"),
      value: t("kpi.count", { count: kpis.feedbackWaitingCount }),
      description: t("kpi.feedbackWaitingDescription"),
      icon: Clock3,
      tone: "library-kpi-icon--secondary",
    },
    {
      key: "comparison",
      label: t("kpi.comparison"),
      value: t("kpi.count", { count: kpis.comparisonAvailableCount }),
      description: t("kpi.comparisonDescription"),
      icon: Link2,
      tone: "library-kpi-icon--link",
    },
    {
      key: "recentStudy",
      label: t("kpi.recentStudy"),
      value:
        formatDashboardMonthDay(kpis.recentSubmissionDate, locale) ??
        t("kpi.noRecentStudy"),
      description: t("kpi.recentStudyDescription"),
      icon: CalendarDays,
      tone: "library-kpi-icon--muted",
    },
  ];

  return (
    <div data-testid="library-kpi-strip" className="grid gap-4 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <AppCard key={item.key} size="small" data-testid="library-kpi-card">
            <div className="flex min-h-[86px] items-center gap-4">
              <span
                className={[
                  "library-kpi-icon flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
                  item.tone,
                ].join(" ")}
              >
                <Icon aria-hidden size={25} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <Text className="block text-sm">{item.label}</Text>
                <Text strong className="block text-2xl leading-tight">
                  {item.value}
                </Text>
                <Text type="secondary" className="block text-xs">
                  {item.description}
                </Text>
              </span>
              <ChevronRight aria-hidden size={18} className="text-text-secondary" />
            </div>
          </AppCard>
        );
      })}
    </div>
  );
}
