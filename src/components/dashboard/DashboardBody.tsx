"use client";

import type { ReactNode } from "react";
import { Button, Empty, Typography } from "antd";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  RecentFeedbackCard,
  type RecentFeedbackItem,
} from "@/components/learning/RecentFeedbackCard";
import { UpcomingExamCard } from "@/components/learning/UpcomingExamCard";
import { AppCard } from "@/components/shared/AppCard";
import { writingFeedbackHref, writingProblemHref } from "@/lib/writing/routes";
import {
  DashboardAlertsCard,
  type DashboardAlertItem,
} from "./DashboardAlertsCard";
import {
  DashboardKpiSummary,
  type DashboardKpiData,
} from "./DashboardKpiSummary";
import type {
  DashboardAlternative,
  DashboardPrimary,
} from "./DashboardRecommendations";

const { Paragraph, Text } = Typography;

type Props = {
  kpi: DashboardKpiData;
  examDate: string | null;
  primary: DashboardPrimary | null;
  alternatives: DashboardAlternative[];
  recentFeedbacks: RecentFeedbackItem[];
  alerts: DashboardAlertItem[];
  alertsLoadFailed: boolean;
};

function truncateLabel(value: string, max = 34): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function DashboardBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-secondary">
      {children}
    </span>
  );
}

export function DashboardBody({
  kpi,
  examDate,
  primary,
  alternatives,
  recentFeedbacks,
  alerts,
  alertsLoadFailed,
}: Props) {
  const t = useTranslations("dashboard.hub");
  const primaryHref = primary
    ? writingProblemHref({
        questionNo: primary.questionNo,
        problemId: primary.problemId,
      })
    : "/practice/recommendations";
  const primaryQuestionTag =
    primary?.questionNo != null
      ? t("questionTag", { no: primary.questionNo })
      : t("questionTagFallback");
  const feedbackPreview = recentFeedbacks.slice(0, 2);
  const feedbackCount = recentFeedbacks.length;
  const firstFeedbackHref = feedbackPreview[0]
    ? writingFeedbackHref({
        questionNo: feedbackPreview[0].questionNo,
        submissionId: feedbackPreview[0].submissionId,
      })
    : "/library";
  const quickActions = [
    {
      href: "/practice/recommendations",
      icon: <Target aria-hidden size={18} />,
      title: t("quickProblemTypes"),
      description: t("quickProblemTypesDesc"),
    },
    {
      href: "/practice/problems",
      icon: <RotateCcw aria-hidden size={18} />,
      title: t("quickRetry"),
      description: t("quickRetryDesc"),
    },
    {
      href: "/growth",
      icon: <BarChart3 aria-hidden size={18} />,
      title: t("quickAiGuide"),
      description: t("quickAiGuideDesc"),
    },
    {
      href: "/onboarding/learning-goal",
      icon: <ClipboardList aria-hidden size={18} />,
      title: t("quickGoal"),
      description: t("quickGoalDesc"),
    },
  ];
  const alternativeTags = alternatives.slice(0, 2);

  return (
    <div className="grid gap-6">
      <DashboardKpiSummary kpi={kpi} />

      <section className="grid gap-5 lg:grid-cols-12" aria-label={t("hubAria")}>
        <AppCard className="h-full lg:col-span-5">
          <div className="grid h-full gap-6 md:grid-cols-3 md:items-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-border bg-surface text-text md:col-span-1">
              <Sparkles aria-hidden size={30} />
            </div>
            <div className="grid gap-4 md:col-span-2">
              <Text strong className="!text-sm !text-text-secondary">
                {t("aiTutorTitle")}
              </Text>
              <h2 className="m-0 text-2xl font-semibold leading-tight text-text">
                {primary
                  ? truncateLabel(primary.title)
                  : t("aiTutorFallbackTitle")}
              </h2>
              <Paragraph type="secondary" className="!m-0 !text-sm !leading-6">
                {primary?.reason ?? t("aiTutorBody")}
              </Paragraph>
              <div className="flex flex-wrap gap-2">
                <DashboardBadge>{primaryQuestionTag}</DashboardBadge>
                <DashboardBadge>{t("estimatedTime")}</DashboardBadge>
                <DashboardBadge>{t("reasonTag")}</DashboardBadge>
                {alternativeTags.map((alt) => (
                  <DashboardBadge key={alt.problemId}>
                    {alt.questionNo != null
                      ? t("questionTag", { no: alt.questionNo })
                      : t("questionTagFallback")}
                  </DashboardBadge>
                ))}
              </div>
              <Link href={primaryHref as never}>
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRight size={16} />}
                >
                  {t("solveNow")}
                </Button>
              </Link>
            </div>
          </div>
        </AppCard>

        <AppCard className="h-full lg:col-span-3">
          <div className="grid h-full gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text strong>{t("continueTitle")}</Text>
              <DashboardBadge>{t("continueTag")}</DashboardBadge>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
              <span className="mt-0.5 inline-flex text-text">
                <BookOpenCheck aria-hidden size={20} />
              </span>
              <div className="grid min-w-0 gap-1">
                <Text strong>
                  {primary
                    ? truncateLabel(primary.title, 26)
                    : t("continueFallbackTitle")}
                </Text>
                <Paragraph type="secondary" className="!m-0 !text-sm !leading-6">
                  {primary?.reason ?? t("continueBody")}
                </Paragraph>
              </div>
            </div>
            <Link href={primaryHref as never}>
              <Button block size="large" icon={<ArrowRight size={16} />}>
                {t("continueCta")}
              </Button>
            </Link>
          </div>
        </AppCard>

        <AppCard className="h-full lg:col-span-4">
          <div className="grid h-full gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text strong>{t("pendingTitle")}</Text>
              <DashboardBadge>
                {t("pendingBadge", { count: feedbackCount })}
              </DashboardBadge>
            </div>
            {feedbackPreview.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t("pendingEmpty")}
              />
            ) : (
              <div className="grid gap-2">
                {feedbackPreview.map((item) => (
                  <Link
                    key={item.submissionId}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-text transition hover:border-text"
                    href={
                      writingFeedbackHref({
                        questionNo: item.questionNo,
                        submissionId: item.submissionId,
                      }) as never
                    }
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-default bg-surface text-sm font-semibold text-text">
                      {item.questionNo ?? "?"}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <strong className="truncate text-sm">
                        {item.questionNo != null
                          ? t("feedbackQuestion", { no: item.questionNo })
                          : t("feedbackQuestionFallback")}
                      </strong>
                      <small className="text-xs text-text-secondary">
                        {t("feedbackItemHint")}
                      </small>
                    </span>
                    <ArrowRight aria-hidden size={16} className="flex-none" />
                  </Link>
                ))}
              </div>
            )}
            <Link href={firstFeedbackHref as never}>
              <Button block size="large">
                {t("reportCta")}
              </Button>
            </Link>
          </div>
        </AppCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentFeedbackCard items={recentFeedbacks} />
        </div>
        <div className="grid gap-5 lg:col-span-1">
          <AppCard title={t("quickStartTitle")}>
            <div className="grid gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href as never}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 text-text transition hover:border-text"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-default bg-surface text-text">
                    {action.icon}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <strong className="truncate text-sm">{action.title}</strong>
                    <small className="text-xs leading-5 text-text-secondary">
                      {action.description}
                    </small>
                  </span>
                  <ArrowRight aria-hidden size={16} className="flex-none" />
                </Link>
              ))}
            </div>
          </AppCard>
          <UpcomingExamCard examDate={examDate} />
          <DashboardAlertsCard alerts={alerts} loadFailed={alertsLoadFailed} />
        </div>
      </section>
    </div>
  );
}
