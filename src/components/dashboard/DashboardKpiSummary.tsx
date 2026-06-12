"use client";

import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";

/**
 * B-01 area 2: KPI summary.
 *
 * The wireframe requires four KPI elements. When a KPI value is empty or 0,
 * the tile keeps its place and shows the start-guidance copy instead.
 */

export type DashboardKpiData = {
  todayAttempts: number;
  totalAttempts: number;
  /** Recent feedback count. */
  recentFeedbackCount: number;
  /** Goal achievement percentage. Null when it cannot be calculated yet. */
  goalAchievementPct: number | null;
  streakDays: number;
  /** Data timestamp in ISO format. */
  updatedAt: string;
};

type Props = {
  kpi: DashboardKpiData;
};

function KpiTile({
  title,
  value,
  suffix,
  isPrompt = false,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  isPrompt?: boolean;
}) {
  return (
    <AppCard size="small" className="h-full">
      <div className="grid gap-2">
        <span className="text-xs font-medium text-text-secondary">{title}</span>
        <span
          className={
            isPrompt
              ? "text-sm font-semibold leading-5 text-text"
              : "flex min-w-0 items-baseline gap-1 text-2xl font-semibold leading-none text-text"
          }
        >
          <span className={isPrompt ? "" : "truncate"}>{value}</span>
          {suffix && !isPrompt ? (
            <span className="text-base font-medium text-text">{suffix}</span>
          ) : null}
        </span>
      </div>
    </AppCard>
  );
}

function isEmptyKpiValue(value: number | null): boolean {
  return value == null || value === 0;
}

export function DashboardKpiSummary({ kpi }: Props) {
  const t = useTranslations("dashboard.kpi");

  const startPrompt = t("zeroValuePrompt");
  const todayIsEmpty = isEmptyKpiValue(kpi.todayAttempts);
  const feedbackIsEmpty = isEmptyKpiValue(kpi.recentFeedbackCount);
  const goalIsEmpty = isEmptyKpiValue(kpi.goalAchievementPct);
  const streakIsEmpty = isEmptyKpiValue(kpi.streakDays);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          title={t("todaySubmissionsTitle")}
          value={todayIsEmpty ? startPrompt : kpi.todayAttempts}
          suffix={t("todaySubmissionsSuffix")}
          isPrompt={todayIsEmpty}
        />
        <KpiTile
          title={t("recentFeedbackTitle")}
          value={feedbackIsEmpty ? startPrompt : kpi.recentFeedbackCount}
          suffix={t("recentFeedbackSuffix")}
          isPrompt={feedbackIsEmpty}
        />
        <KpiTile
          title={t("goalAchievementTitle")}
          value={
            goalIsEmpty
              ? startPrompt
              : (kpi.goalAchievementPct ?? startPrompt)
          }
          suffix={goalIsEmpty ? undefined : "%"}
          isPrompt={goalIsEmpty}
        />
        <KpiTile
          title={t("streakTitle")}
          value={streakIsEmpty ? startPrompt : kpi.streakDays}
          suffix={t("streakSuffix")}
          isPrompt={streakIsEmpty}
        />
      </div>
    </div>
  );
}
