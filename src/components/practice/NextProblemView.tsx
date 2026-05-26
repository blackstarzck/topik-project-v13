"use client";

import { Button, Card, Empty, Space, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";
import { logStudyEvent } from "@/lib/events/study-events";
import type { NextProblemBundle } from "@/lib/practice/next";
import { SummaryCardRow } from "./SummaryCardRow";
import { AlternativeCardsGrid } from "./AlternativeCardsGrid";

const { Title, Paragraph, Text } = Typography;

type TierMeta = {
  badge: string;
  color: string;
  description: string;
};

const TIER_META: Record<1 | 2 | 3, TierMeta> = {
  1: {
    badge: "추천",
    color: "gold",
    description: "선생님이 추천한 문제예요.",
  },
  2: {
    badge: "이어서",
    color: "blue",
    description: "방금 푼 문항과 같은 유형으로 계속 풀어볼까요?",
  },
  3: {
    badge: "탐색",
    color: "green",
    description: "오늘 처음 만나는 문제예요.",
  },
};

type Props = {
  bundle: NextProblemBundle;
};

export function NextProblemView({ bundle }: Props) {
  const router = useRouter();
  const { primary, primaryTier, summary, alternatives } = bundle;

  function handleClick() {
    if (!primary) return;
    void logStudyEvent({
      eventType: "recommendation_clicked",
      problemId: primary.problemId,
      payload: { source: "next" },
    });
    router.push(`/practice/problems/${primary.problemId}` as never);
  }

  if (primaryTier === 4 || !primary) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <SummaryCardRow
          recentSubmissions={summary.recentSubmissions}
          averageScore={summary.averageScore}
          weakestDimensions={summary.weakestDimensions}
        />
        <Empty description="더 추천할 문제가 없습니다.">
          <Button
            type="primary"
            onClick={() => router.push("/practice/problems" as never)}
          >
            문제 목록 보기
          </Button>
        </Empty>
      </Space>
    );
  }

  const meta = TIER_META[primaryTier];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <SummaryCardRow
        recentSubmissions={summary.recentSubmissions}
        averageScore={summary.averageScore}
        weakestDimensions={summary.weakestDimensions}
      />

      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          다음 문제
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          이어 풀기 좋은 문제를 추천해 드릴게요.
        </Paragraph>
      </div>

      <Card
        hoverable
        onClick={handleClick}
        data-testid={`next-problem-${primary.problemId}`}
        title={
          <Space>
            <Tag color={meta.color} data-testid="next-problem-badge">
              {meta.badge}
            </Tag>
            <span>{primary.questionNo ?? "—"}번 문항</span>
          </Space>
        }
        extra={
          <Button type="primary" onClick={handleClick}>
            시작하기
          </Button>
        }
      >
        <Space direction="vertical" size="small">
          <Text strong>
            {primary.title.length > 48
              ? `${primary.title.slice(0, 48)}…`
              : primary.title}
          </Text>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {meta.description}
          </Paragraph>
          {primary.reason ? (
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {primary.reason}
            </Paragraph>
          ) : null}
        </Space>
      </Card>

      <AlternativeCardsGrid alternatives={alternatives} />
    </Space>
  );
}
