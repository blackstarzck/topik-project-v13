"use client";

import { Typography } from "antd";
import { ArrowUpRight as ArrowUpRightIcon } from "lucide-react";
import {
  BarChart3,
  FileText,
  PencilLine,
  type AppIcon,
} from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import type { ExternalFeedbackSupplement } from "@/lib/writing/external-feedback";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Text, Title } = Typography;

type Props = {
  dimensions: FeedbackDimensionScoreRow[];
  retryHref?: string;
  retryDisabled?: boolean;
  supplement?: ExternalFeedbackSupplement;
};

type ActionCard = {
  key: "retry" | "similar" | "weakness";
  href: string;
  icon: AppIcon;
  title: string;
  description: string;
  toneClassName: string;
  disabled?: boolean;
};

export function FeedbackRecommendationCards({
  dimensions,
  retryHref = "/practice/problems",
  retryDisabled = false,
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
      toneClassName: "text-blue-600",
      disabled: retryDisabled,
    },
    {
      key: "similar",
      href: "/practice/next",
      icon: FileText,
      title: t("action.similar.title"),
      description: t("action.similar.description"),
      toneClassName: "text-emerald-600",
    },
    {
      key: "weakness",
      href: `/practice/weakness?focus=${weakest?.dimension ?? "expression"}`,
      icon: BarChart3,
      title: t("action.weakness.title"),
      description: weaknessReason,
      toneClassName: "text-violet-600",
    },
  ];

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="feedback-recommendation-card"
    >
      <Title level={5} className="m-0">
        {t("cardTitle")}
      </Title>

      {/* 진짜 AntD Card(AppCard) 사용. app-cards-bordered로 카드 native border를
          복원하되, 카드 디자인을 손으로 만들지 않는다. 카드 전체가 클릭 영역이며
          button 시맨틱(role/tabIndex/Enter·Space)으로 키보드 접근성을 유지한다. */}
      <div className="app-cards-bordered grid gap-3 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const navigate = () => router.push(action.href);
          const disabled = action.disabled === true;
          return (
            <AppCard
              key={action.key}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled ? true : undefined}
              onClick={() => {
                if (disabled) return;
                navigate();
              }}
              onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate();
                }
              }}
              className={[
                "group h-full",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid={`feedback-reco-action-${action.key}`}
            >
              <div
                className="relative flex h-full min-h-[190px] flex-col"
                data-testid={`feedback-recommendation-layout-${action.key}`}
              >
                <span
                  className={[
                    "absolute left-0 top-0 flex h-6 w-6 flex-shrink-0 items-center justify-center",
                    action.toneClassName,
                  ].join(" ")}
                  data-testid={`feedback-recommendation-icon-${action.key}`}
                >
                  <Icon aria-hidden size={24} strokeWidth={2} />
                </span>
                <ArrowUpRightIcon
                  aria-hidden
                  size={20}
                  strokeWidth={1.8}
                  className="absolute right-0 top-0 text-text-secondary opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100"
                  data-testid={`feedback-recommendation-arrow-${action.key}`}
                />
                <span
                  className="block min-w-0 pr-0 pt-[104px]"
                  data-testid={`feedback-recommendation-copy-${action.key}`}
                >
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
              </div>
            </AppCard>
          );
        })}
      </div>
    </section>
  );
}
