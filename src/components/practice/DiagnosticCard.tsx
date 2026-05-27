"use client";

import { Card, Empty, Tag, Typography } from "antd";

const { Text, Title, Paragraph } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

type WeakDimension = {
  dimension: string;
  averageScore: number;
  sampleCount?: number;
};

type Props = {
  /** weak 차원 array (오름차순 점수). 첫 번째가 가장 약한 차원. */
  weakDimensions: WeakDimension[];
  /** 마지막 분석 갱신 시각 (ISO). */
  updatedAt?: string | null;
};

/**
 * Phase 7-D Task 7 (P1-3) — X-07 진단 카드.
 * 가장 약한 차원 1개 강조 + 분석 갱신일 + AI 코멘트(시드 또는 향후 LLM).
 */
export function DiagnosticCard({ weakDimensions, updatedAt }: Props) {
  if (weakDimensions.length === 0) {
    return (
      <Card>
        <Empty description="아직 분석할 데이터가 부족해요. 글쓰기를 제출하면 약점이 점점 명확해집니다." />
      </Card>
    );
  }

  const primary = weakDimensions[0];
  const label = DIMENSION_LABELS[primary.dimension] ?? primary.dimension;

  return (
    <Card>
      <Title level={5}>가장 보강이 필요한 영역</Title>
      <Paragraph>
        <Tag color="red" style={{ fontSize: 14, padding: "4px 8px" }}>
          {label}
        </Tag>
        <Text> 평균 점수 {Math.round(primary.averageScore)}점.</Text>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">
          이 영역의 문제를 더 풀면 점수가 빠르게 오를 가능성이 있습니다.
          아래 차원별 진행을 확인하고 추천 문제를 풀어보세요.
        </Text>
      </Paragraph>
      {updatedAt ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          분석 갱신: {new Date(updatedAt).toLocaleString("ko-KR")}
        </Text>
      ) : null}
    </Card>
  );
}
