"use client";

import { Button, Card, Empty, Space, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";
import { logStudyEvent } from "@/lib/events/study-events";

const { Title, Paragraph, Text } = Typography;

type Tier = 1 | 2 | 3 | 4;

type Problem = {
  id: string;
  title: string;
  question_no: number;
};

type Props = {
  problem: Problem | null;
  tier: Tier;
};

type TierMeta = {
  badge: string;
  color: string;
  description: string;
};

const TIER_META: Record<Exclude<Tier, 4>, TierMeta> = {
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

export function NextProblemView({ problem, tier }: Props) {
  const router = useRouter();

  if (tier === 4 || !problem) {
    return (
      <Empty description="더 추천할 문제가 없습니다.">
        <Button
          type="primary"
          onClick={() => router.push("/practice/problems" as never)}
        >
          문제 목록 보기
        </Button>
      </Empty>
    );
  }

  const meta = TIER_META[tier];

  function handleClick() {
    if (!problem) return;
    void logStudyEvent({
      eventType: "recommendation_clicked",
      problemId: problem.id,
      payload: { source: "next" },
    });
    router.push(`/practice/problems/${problem.id}` as never);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
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
        data-testid={`next-problem-${problem.id}`}
        title={
          <Space>
            <Tag color={meta.color} data-testid="next-problem-badge">
              {meta.badge}
            </Tag>
            <span>{problem.question_no}번 문항</span>
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
            {problem.title.length > 48
              ? `${problem.title.slice(0, 48)}…`
              : problem.title}
          </Text>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {meta.description}
          </Paragraph>
        </Space>
      </Card>
    </Space>
  );
}
