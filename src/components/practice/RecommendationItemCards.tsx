"use client";

import type { ReactNode } from "react";
import { Button, Typography } from "antd";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppCard } from "@/components/shared/AppCard";
import { writingProblemHref } from "@/lib/writing/routes";
import type { RecommendationItemCard } from "./recommendations-data";

const { Paragraph, Text, Title } = Typography;

function ctaHref(card: RecommendationItemCard): string {
  return writingProblemHref({
    questionNo: card.questionNo,
    problemId: card.problemId,
  });
}

function RecommendationBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary";
}) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "primary"
          ? "border-primary bg-primary text-background"
          : "border-border bg-surface text-text-secondary",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** C-01 §3 — 취약 태그 근거 (recommendation_items.weakness_tags). */
function WeaknessTags({ tags }: { tags: string[] }) {
  const t = useTranslations("practice.recommendations");
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Text className="text-xs" type="secondary">
        {t("weaknessTagsLabel")}
      </Text>
      {tags.slice(0, 4).map((tag) => (
        <RecommendationBadge key={tag}>{tag}</RecommendationBadge>
      ))}
    </div>
  );
}

/**
 * C-01 §3 — 대표 추천 1개를 크게 노출. 제목 32자, 추천 사유 2줄 이하.
 */
export function PrimaryRecommendationCard({
  card,
}: {
  card: RecommendationItemCard;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const title =
    card.title.length > 32 ? `${card.title.slice(0, 32)}…` : card.title;
  return (
    <AppCard
      className="h-full"
      title={
        <div className="flex flex-wrap gap-2">
          <RecommendationBadge tone="primary">
            {t("primaryBadge")}
          </RecommendationBadge>
          {card.questionNo ? (
            <RecommendationBadge>
              {tCommon("questionNo", { no: card.questionNo })}
            </RecommendationBadge>
          ) : null}
        </div>
      }
      extra={
        card.estimatedMinutes ? (
          <RecommendationBadge>
            {tCommon("minutes", { minutes: card.estimatedMinutes })}
          </RecommendationBadge>
        ) : null
      }
    >
      <Title className="mt-0" level={3}>
        {title}
      </Title>
      {card.reason ? (
        <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
      <div className="mt-4">
        <Link href={ctaHref(card) as never}>
          <Button type="primary" size="large" block>
            {t("startFromThis")}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </AppCard>
  );
}

/** 대표 추천 외 나머지 추천(compact). */
export function SecondaryRecommendationCard({
  card,
}: {
  card: RecommendationItemCard;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const title =
    card.title.length > 32 ? `${card.title.slice(0, 32)}…` : card.title;
  return (
    <AppCard
      className="h-full"
      size="small"
      title={
        card.questionNo
          ? tCommon("questionNo", { no: card.questionNo })
          : t("recommendationFallback")
      }
      extra={
        card.estimatedMinutes ? (
          <RecommendationBadge>
            {tCommon("minutes", { minutes: card.estimatedMinutes })}
          </RecommendationBadge>
        ) : null
      }
    >
      <Text strong>{title}</Text>
      {card.reason ? (
        <Paragraph className="mt-2" type="secondary" ellipsis={{ rows: 2 }}>
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
      <div className="mt-3">
        <Link href={ctaHref(card) as never}>
          <Button block>
            {t("continueProblem")}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </AppCard>
  );
}
