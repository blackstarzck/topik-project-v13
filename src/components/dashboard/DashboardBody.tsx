"use client";

import { Button, Empty, Flex, Space, Tag, Typography } from "antd";
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
    <Space
      className="dashboard-workspace"
      orientation="vertical"
      size="large"
      style={{ width: "100%" }}
    >
      <DashboardKpiSummary kpi={kpi} />

      <section className="dashboard-hub-grid" aria-label={t("hubAria")}>
        <AppCard className="dashboard-ai-card">
          <div className="dashboard-ai-card__body">
            <div className="dashboard-ai-card__mark">
              <Sparkles aria-hidden size={30} />
            </div>
            <div className="dashboard-ai-card__content">
              <Text strong className="dashboard-section-kicker">
                {t("aiTutorTitle")}
              </Text>
              <h2>
                {primary
                  ? truncateLabel(primary.title)
                  : t("aiTutorFallbackTitle")}
              </h2>
              <Paragraph type="secondary">
                {primary?.reason ?? t("aiTutorBody")}
              </Paragraph>
              <Flex gap="small" wrap>
                <Tag color="blue">{primaryQuestionTag}</Tag>
                <Tag color="green">{t("estimatedTime")}</Tag>
                <Tag>{t("reasonTag")}</Tag>
                {alternativeTags.map((alt) => (
                  <Tag key={alt.problemId} color="cyan">
                    {alt.questionNo != null
                      ? t("questionTag", { no: alt.questionNo })
                      : t("questionTagFallback")}
                  </Tag>
                ))}
              </Flex>
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

        <AppCard className="dashboard-focus-card">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Flex justify="space-between" align="center" gap="small" wrap>
              <Text strong>{t("continueTitle")}</Text>
              <Tag color="processing">{t("continueTag")}</Tag>
            </Flex>
            <div className="app-card-compact dashboard-focus-card__item">
              <BookOpenCheck aria-hidden size={20} />
              <div>
                <Text strong>
                  {primary
                    ? truncateLabel(primary.title, 26)
                    : t("continueFallbackTitle")}
                </Text>
                <Paragraph type="secondary">
                  {primary?.reason ?? t("continueBody")}
                </Paragraph>
              </div>
            </div>
            <Link href={primaryHref as never}>
              <Button block icon={<ArrowRight size={16} />}>
                {t("continueCta")}
              </Button>
            </Link>
          </Space>
        </AppCard>

        <AppCard className="dashboard-feedback-panel">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Flex justify="space-between" align="center" gap="small" wrap>
              <Text strong>{t("pendingTitle")}</Text>
              <Tag color={feedbackCount > 0 ? "volcano" : "default"}>
                {t("pendingBadge", { count: feedbackCount })}
              </Tag>
            </Flex>
            {feedbackPreview.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t("pendingEmpty")}
              />
            ) : (
              <Space
                orientation="vertical"
                size="small"
                style={{ width: "100%" }}
              >
                {feedbackPreview.map((item) => (
                  <Link
                    key={item.submissionId}
                    className="dashboard-feedback-link"
                    href={
                      writingFeedbackHref({
                        questionNo: item.questionNo,
                        submissionId: item.submissionId,
                      }) as never
                    }
                  >
                    <span className="dashboard-feedback-link__badge">
                      {item.questionNo ?? "?"}
                    </span>
                    <span>
                      <strong>
                        {item.questionNo != null
                          ? t("feedbackQuestion", { no: item.questionNo })
                          : t("feedbackQuestionFallback")}
                      </strong>
                      <small>{t("feedbackItemHint")}</small>
                    </span>
                    <ArrowRight aria-hidden size={16} />
                  </Link>
                ))}
              </Space>
            )}
            <Link href={firstFeedbackHref as never}>
              <Button block>{t("reportCta")}</Button>
            </Link>
          </Space>
        </AppCard>
      </section>

      <section className="dashboard-lower-grid">
        <RecentFeedbackCard items={recentFeedbacks} />
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <AppCard title={t("quickStartTitle")}>
            <Space
              orientation="vertical"
              size="small"
              style={{ width: "100%" }}
            >
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href as never}
                  className="dashboard-quick-action"
                >
                  <span className="dashboard-quick-action__icon">
                    {action.icon}
                  </span>
                  <span>
                    <strong>{action.title}</strong>
                    <small>{action.description}</small>
                  </span>
                  <ArrowRight aria-hidden size={16} />
                </Link>
              ))}
            </Space>
          </AppCard>
          <UpcomingExamCard examDate={examDate} />
          <DashboardAlertsCard alerts={alerts} loadFailed={alertsLoadFailed} />
        </Space>
      </section>
    </Space>
  );
}
