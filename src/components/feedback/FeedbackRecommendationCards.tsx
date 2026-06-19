"use client";

import { Typography } from "antd";
import {
  ArrowRight,
  BarChart3,
  FileText,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ExternalFeedbackSupplement } from "@/lib/writing/external-feedback";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Paragraph, Text, Title } = Typography;

type Props = {
  dimensions: FeedbackDimensionScoreRow[];
  retryHref?: string;
  supplement?: ExternalFeedbackSupplement;
};

type ActionCard = {
  key: "retry" | "similar" | "weakness";
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  toneClassName: string;
};

export function FeedbackRecommendationCards({
  dimensions,
  retryHref = "/practice/problems",
  supplement,
}: Props) {
  const t = useTranslations("feedback.recommendations");
  const router = useRouter();

  const ranked = [...dimensions]
    .filter((dimension) => {
      return dimension.score !== null || dimension.weakness_level !== null;
    })
    .sort((a, b) => {
      const weaknessDiff = (b.weakness_level ?? 0) - (a.weakness_level ?? 0);
      if (weaknessDiff !== 0) return weaknessDiff;
      return (a.score ?? 999) - (b.score ?? 999);
    });
  const weakest = ranked[0] ?? null;
  const weaknessReason =
    supplement?.learning.studyTips?.trim() ||
    weakest?.summary?.trim() ||
    (weakest
      ? t(`reco.${weakest.dimension}.reason`)
      : t("action.weakness.description"));

  const actions: ActionCard[] = [
    {
      key: "retry",
      href: retryHref,
      icon: PencilLine,
      title: t("action.retry.title"),
      description: t("action.retry.description"),
      toneClassName: "bg-blue-50 text-blue-600",
    },
    {
      key: "similar",
      href: "/practice/next",
      icon: FileText,
      title: t("action.similar.title"),
      description: t("action.similar.description"),
      toneClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      key: "weakness",
      href: `/practice/weakness?focus=${weakest?.dimension ?? "expression"}`,
      icon: BarChart3,
      title: t("action.weakness.title"),
      description: weaknessReason,
      toneClassName: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="feedback-recommendation-card"
    >
      <Title level={5} className="mt-0">
        {t("cardTitle")}
      </Title>
      <Paragraph type="secondary" className="mb-4">
        {t("intro")}
      </Paragraph>

      <div className="grid gap-3 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => router.push(action.href)}
              className="group flex h-full min-h-28 w-full items-center gap-4 rounded-md border border-solid border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              data-testid={`feedback-reco-action-${action.key}`}
            >
              <span
                className={[
                  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md",
                  action.toneClassName,
                ].join(" ")}
              >
                <Icon aria-hidden size={24} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <Text strong className="block">
                  {action.title}
                </Text>
                <Text
                  type="secondary"
                  className="mt-1 block break-words leading-relaxed"
                >
                  {action.description}
                </Text>
              </span>
              <ArrowRight
                aria-hidden
                size={20}
                strokeWidth={1.8}
                className="flex-shrink-0 text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
