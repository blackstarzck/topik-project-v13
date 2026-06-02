"use client";

import { Button, Card, Space, Tag, Typography } from "antd";
import Link from "next/link";
import type { RecommendationItemCard } from "./recommendations-data";

const { Paragraph, Text, Title } = Typography;

function ctaHref(card: RecommendationItemCard): string {
  return card.questionNo ? `/writing/${card.questionNo}` : "/practice/problems";
}

/** C-01 §3 — 취약 태그 근거 (recommendation_items.weakness_tags). */
function WeaknessTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <Space size={4} wrap style={{ marginTop: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        보완 포인트
      </Text>
      {tags.slice(0, 4).map((t) => (
        <Tag key={t} color="volcano">
          {t}
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
  const title =
    card.title.length > 32 ? `${card.title.slice(0, 32)}…` : card.title;
  return (
    <Card
      style={{ borderColor: "#1677ff", borderWidth: 2 }}
      title={
        <Space>
          <Tag color="blue">대표 추천</Tag>
          {card.questionNo ? <Tag>{card.questionNo}번</Tag> : null}
        </Space>
      }
      extra={
        card.estimatedMinutes ? (
          <Tag color="geekblue">{card.estimatedMinutes}분</Tag>
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
            이 문제부터 시작하기
          </Button>
        </Link>
      </div>
    </Card>
  );
}

/** 대표 추천 외 나머지 추천(compact). */
export function SecondaryRecommendationCard({
  card,
}: {
  card: RecommendationItemCard;
}) {
  const title =
    card.title.length > 32 ? `${card.title.slice(0, 32)}…` : card.title;
  return (
    <Card
      size="small"
      title={card.questionNo ? `${card.questionNo}번` : "추천"}
      extra={
        card.estimatedMinutes ? (
          <Tag color="blue">{card.estimatedMinutes}분</Tag>
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
          <Button block>이어 풀기</Button>
        </Link>
      </div>
    </Card>
  );
}
