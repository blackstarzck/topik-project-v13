"use client";

import { Button, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AppCard } from "@/components/shared/AppCard";

const { Text } = Typography;

/**
 * B-01 area 2 — KPI 요약.
 *
 * Wireframe Number Map area 2: "오늘 제출, 최근 첨삭, 목표 달성, 연속 학습".
 * 제약 조건: KPI 4개 이하, 수치 라벨 1줄, 업데이트 시각 표시.
 * 예외: 신규 사용자는 0값 대신 시작 유도 문구를 표시.
 */

export type DashboardKpiData = {
  todayAttempts: number;
  totalAttempts: number;
  /** 최근 첨삭(받은 피드백) 건수. */
  recentFeedbackCount: number;
  /** 목표 달성률(%) — 목표 없으면 null. */
  goalAchievementPct: number | null;
  streakDays: number;
  /** 데이터 기준 시각(ISO). */
  updatedAt: string;
};

type Props = {
  kpi: DashboardKpiData;
};

function KpiTile({
  title,
  value,
  suffix,
}: {
  title: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <AppCard size="small" className="h-full">
      <div className="grid gap-2">
        <span className="text-xs font-medium text-text-secondary">{title}</span>
        <span className="flex min-w-0 items-baseline gap-1 text-2xl font-semibold leading-none text-text">
          <span className="truncate">{value}</span>
          {suffix ? (
            <span className="text-base font-medium text-text">{suffix}</span>
          ) : null}
        </span>
      </div>
    </AppCard>
  );
}

export function DashboardKpiSummary({ kpi }: Props) {
  const t = useTranslations("dashboard.kpi");
  const isNewUser =
    kpi.todayAttempts === 0 &&
    kpi.totalAttempts === 0 &&
    kpi.streakDays === 0 &&
    kpi.recentFeedbackCount === 0;

  // SSR/client hydration must produce the IDENTICAL string or React hydration mismatch fires.
  // Two ICU traps: (1) timezone — pin Asia/Seoul (KST is canonical for this
  // Korea-centric TOPIK app) so the value doesn't depend on the runtime tz;
  // (2) day-period — Node's ICU renders the ko-KR AM/PM marker as "PM"/"AM"
  // while the browser renders "오후"/"오전", so force 24-hour (hour12: false) to
  // drop the day-period entirely. Result is deterministic across server+client.
  const updatedLabel = new Date(kpi.updatedAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isNewUser) {
    // 예외: 신규 사용자는 0값 대신 시작 유도 문구.
    return (
      <AppCard>
        <div className="mx-auto grid max-w-xl justify-items-center gap-3 text-center">
          <Text strong className="!text-base">
            {t("newUserTitle")}
          </Text>
          <Text type="secondary">{t("newUserBody")}</Text>
          <Link href="/practice/recommendations">
            <Button type="primary" size="large">
              {t("newUserCta")}
            </Button>
          </Link>
        </div>
      </AppCard>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          title={t("todaySubmissionsTitle")}
          value={kpi.todayAttempts}
          suffix={t("todaySubmissionsSuffix")}
        />
        <KpiTile
          title={t("recentFeedbackTitle")}
          value={kpi.recentFeedbackCount}
          suffix={t("recentFeedbackSuffix")}
        />
        <KpiTile
          title={t("goalAchievementTitle")}
          value={kpi.goalAchievementPct != null ? kpi.goalAchievementPct : "?"}
          suffix={kpi.goalAchievementPct != null ? "%" : undefined}
        />
        <KpiTile
          title={t("streakTitle")}
          value={kpi.streakDays}
          suffix={t("streakSuffix")}
        />
      </div>
      <Text type="secondary" className="!text-xs">
        {t("updatedAt", { time: updatedLabel })}
      </Text>
    </div>
  );
}
