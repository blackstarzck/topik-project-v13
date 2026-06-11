"use client";

import { Button, Space, Tag, Typography } from "antd";
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

/** C-01 §3 — 취약 태그 근거 (recommendation_items.weakness_tags). */
function WeaknessTags({ tags }: { tags: string[] }) {
  const t = useTranslations("practice.recommendations");
  if (tags.length === 0) return null;
  return (
    <Space className="recommendation-weakness-tags" size={4} wrap>
      <Text
        className="recommendation-weakness-tags__label"
        type="secondary"
      >
        {t("weaknessTagsLabel")}
      </Text>
      {tags.slice(0, 4).map((tag) => (
        <Tag key={tag} color="volcano">
          {tag}
        </Tag>
      ))}
    </Space>
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
      className="recommendation-primary-card"
      title={
        <Space>
          <Tag color="blue">{t("primaryBadge")}</Tag>
          {card.questionNo ? (
            <Tag>{tCommon("questionNo", { no: card.questionNo })}</Tag>
          ) : null}
        </Space>
      }
      extra={
        card.estimatedMinutes ? (
          <Tag color="geekblue">
            {tCommon("minutes", { minutes: card.estimatedMinutes })}
          </Tag>
        ) : null
      }
    >
      <Title className="recommendation-card-title" level={4}>
        {title}
      </Title>
      {card.reason ? (
        <Paragraph
          className="recommendation-card-reason"
          type="secondary"
          ellipsis={{ rows: 2 }}
        >
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
      <div className="recommendation-card-cta">
        <Link href={ctaHref(card) as never}>
          <Button type="primary" size="large" block>
            {t("startFromThis")}
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
      className="recommendation-secondary-card"
      size="small"
      title={
        card.questionNo
          ? tCommon("questionNo", { no: card.questionNo })
          : t("recommendationFallback")
      }
      extra={
        card.estimatedMinutes ? (
          <Tag color="blue">
            {tCommon("minutes", { minutes: card.estimatedMinutes })}
          </Tag>
        ) : null
      }
    >
      <Text strong>{title}</Text>
      {card.reason ? (
        <Paragraph
          className="recommendation-card-reason recommendation-card-reason--secondary"
          type="secondary"
          ellipsis={{ rows: 2 }}
        >
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
      <div className="recommendation-card-cta recommendation-card-cta--secondary">
        <Link href={ctaHref(card) as never}>
          <Button block>{t("continueProblem")}</Button>
        </Link>
      </div>
    </AppCard>
  );
}
