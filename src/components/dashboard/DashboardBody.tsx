"use client";

import type { ReactNode } from "react";
import { Button, Empty, Typography } from "antd";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  RotateCcw,
  Target,
} from "@/components/shared/AppIcons";
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

const cardFooterClassNames = {
  body: "flex-1",
  actions: "app-card-footer-actions",
};

type Props = {
  userId: string;
  kpi: DashboardKpiData;
  examDate: string | null;
  primary: DashboardPrimary | null;
  continueDraft: DashboardContinueDraft | null;
  alternatives: DashboardAlternative[];
  recentFeedbacks: RecentFeedbackItem[];
  alerts: DashboardAlertItem[];
  alertsLoadFailed: boolean;
};

export type DashboardContinueDraft = {
  problemId: string;
  title: string;
  questionNo: number | null;
  lastSavedAt: string | null;
};

function truncateLabel(value: string, max = 34): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function DashboardBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-sm bg-surface px-3 text-sm font-semibold text-text-secondary">
      {children}
    </span>
  );
}

export function DashboardBody({
  userId,
  kpi,
  examDate,
  primary,
  continueDraft,
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
  const continueHref = continueDraft
    ? writingProblemHref({
        questionNo: continueDraft.questionNo,
        problemId: continueDraft.problemId,
      })
    : "/practice/problems";
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
        <AppCard
          className="flex h-full flex-col lg:col-span-5"
          classNames={cardFooterClassNames}
          actions={[
            <Link
              key="solve-now"
              href={primaryHref as never}
              className="inline-flex"
            >
              <Button
                type="primary"
                size="large"
                icon={<ArrowRight size={16} />}
              >
                {t("solveNow")}
              </Button>
            </Link>,
          ]}
        >
          <div className="grid h-full gap-4">
            <div className="grid gap-4">
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
            </div>
          </div>
        </AppCard>

        <AppCard
          title={t("continueTitle")}
          extra={
            <DashboardBadge>
              {continueDraft ? t("continueTag") : t("continueEmptyTag")}
            </DashboardBadge>
          }
          className="flex h-full flex-col lg:col-span-3"
          classNames={cardFooterClassNames}
          actions={[
            <Link
              key="continue-writing"
              href={continueHref as never}
              className="block"
            >
              <Button block size="large" icon={<ArrowRight size={16} />}>
                {continueDraft ? t("continueCta") : t("continueEmptyCta")}
              </Button>
            </Link>,
          ]}
        >
          <div className="grid h-full gap-4">
            <div className="flex items-start gap-3 py-3">
              <span
                className={
                  continueDraft
                    ? "mt-0.5 inline-flex text-text"
                    : "mt-0.5 inline-flex text-text-secondary"
                }
              >
                <BookOpenCheck aria-hidden size={20} />
              </span>
              <div className="grid min-w-0 gap-1">
                <Text strong>
                  {continueDraft
                    ? truncateLabel(continueDraft.title, 26)
                    : t("continueEmptyTitle")}
                </Text>
                <Paragraph
                  type="secondary"
                  className="!m-0 !text-sm !leading-6"
                >
                  {continueDraft
                    ? t("continueDraftBody")
                    : t("continueEmptyBody")}
                </Paragraph>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard
          title={t("pendingTitle")}
          extra={
            <DashboardBadge>
              {t("pendingBadge", { count: feedbackCount })}
            </DashboardBadge>
          }
          className="flex h-full flex-col lg:col-span-4"
          classNames={cardFooterClassNames}
          actions={[
            <Link
              key="feedback-report"
              href={firstFeedbackHref as never}
              className="block"
            >
              <Button block size="large">
                {t("reportCta")}
              </Button>
            </Link>,
          ]}
        >
          <div className="grid h-full gap-4">
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
                    className="-mx-2 flex items-center gap-3 px-2 py-3 text-text transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                    href={
                      writingFeedbackHref({
                        questionNo: item.questionNo,
                        submissionId: item.submissionId,
                      }) as never
                    }
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-sm bg-surface text-sm font-semibold text-text">
                      {item.questionNo ?? "?"}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <strong className="truncate text-sm">
                        {item.questionNo != null
                          ? t("feedbackQuestion", { no: item.questionNo })
                          : t("feedbackQuestionFallback")}
                      </strong>
                      <small className="text-sm text-text-secondary">
                        {t("feedbackItemHint")}
                      </small>
                    </span>
                    <ArrowRight aria-hidden size={16} className="flex-none" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </AppCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="flex lg:col-span-2">
          <RecentFeedbackCard
            items={recentFeedbacks}
            className="w-full lg:h-full"
          />
        </div>
        <div className="grid gap-5 lg:col-span-1">
          <AppCard title={t("quickStartTitle")}>
            <div className="grid gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href as never}
                  className="-mx-2 flex items-center gap-3 px-2 py-3 text-text transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-sm bg-surface text-text">
                    {action.icon}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <strong className="truncate text-sm">{action.title}</strong>
                    <small className="text-sm leading-5 text-text-secondary">
                      {action.description}
                    </small>
                  </span>
                  <ArrowRight aria-hidden size={16} className="flex-none" />
                </Link>
              ))}
            </div>
          </AppCard>
          <UpcomingExamCard examDate={examDate} />
          <DashboardAlertsCard
            userId={userId}
            alerts={alerts}
            loadFailed={alertsLoadFailed}
          />
        </div>
      </section>
    </div>
  );
}
