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
    <Space size={4} wrap style={{ marginTop: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
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
      style={{ borderColor: "#1677ff", borderWidth: 2 }}
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
      <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
        {title}
      </Title>
      {card.reason ? (
        <Paragraph
          type="secondary"
          ellipsis={{ rows: 2 }}
          style={{ marginBottom: 8 }}
        >
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
      <div style={{ marginTop: 16 }}>
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
          type="secondary"
          ellipsis={{ rows: 2 }}
          style={{ margin: "8px 0" }}
        >
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
      <div style={{ marginTop: 12 }}>
        <Link href={ctaHref(card) as never}>
          <Button block>{t("continueProblem")}</Button>
        </Link>
      </div>
    </AppCard>
  );
}
