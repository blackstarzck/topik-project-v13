"use client";

import { Button, Card, Empty, Space, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";

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
  /**
   * Phase 7-D follow-up (X-07 §3 예외) — 분석 실패/데이터 없음을 명시적으로
   * 표시할지. true면 weakDimensions가 비어 있어도 "실패" 톤의 빈 상태 + 다시
   * 분석 CTA를 보여준다. 기본 false (데이터 부족 톤).
   */
  failed?: boolean;
};

/**
 * Phase 7-D Task 7 (P1-3) — X-07 핵심 진단 카드.
 * 가장 약한 차원 1개 강조 + 분석 갱신일.
 * 예외(§3): 추천 없음/분석 실패는 빈 상태와 다시 분석 CTA 표시.
 */
export function DiagnosticCard({ weakDimensions, updatedAt, failed }: Props) {
  const router = useRouter();

  if (weakDimensions.length === 0) {
    return (
      <Card data-testid="diagnostic-empty">
        <Empty
          description={
            failed
              ? "약점 분석을 만들지 못했어요. 답안을 더 제출한 뒤 다시 분석해 주세요."
              : "아직 분석할 데이터가 부족해요. 글쓰기를 제출하면 약점이 점점 명확해집니다."
          }
        >
          <Space direction="vertical" size="small">
            <Button
              type="primary"
              onClick={() => router.push("/practice/problems" as never)}
              data-testid="diagnostic-reanalyze"
            >
              다시 분석하기
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              새 답안을 제출하면 다음 분석 때 약점이 자동으로 갱신돼요.
            </Text>
          </Space>
        </Empty>
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
          이 영역의 문제를 더 풀면 점수가 빠르게 오를 가능성이 있습니다. 아래
          차원별 진행을 확인하고 추천 문제를 풀어보세요.
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
