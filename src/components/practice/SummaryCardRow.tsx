"use client";

import { Card, Col, Row, Statistic, Tag, Typography } from "antd";

const { Text } = Typography;

type WeakDimension = { dimension: string; score: number };

type Props = {
  recentSubmissions: number;
  averageScore: number | null;
  weakestDimensions: WeakDimension[];
  /**
   * Phase 7-D follow-up (R-02 §1) — 예상 학습 시간 카드. Minutes from the
   * recommended item's `estimated_minutes`. null → "정보 없음".
   */
  estimatedMinutes?: number | null;
  /** 다음 추천 유형 라벨 (예: "53번 장문"). null → "추천 준비 중". */
  recommendedType?: string | null;
};

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

/**
 * Phase 7-D Task 6 (P1-2) — R-02 성과 요약 카드.
 * IA: docs/Wireframe/17-R-02-next-problem-recommendation/description.md §1.
 * 제약: 요약 카드 3개 이하, 각 카드 제목 18자, 수치 1줄.
 * 3개 카드: 완료 문제의 약점 / 다음 추천 유형 / 예상 학습 시간.
 */
export function SummaryCardRow({
  recentSubmissions,
  averageScore,
  weakestDimensions,
  estimatedMinutes,
  recommendedType,
}: Props) {
  return (
    <Row gutter={16} data-testid="summary-card-row">
      <Col xs={24} md={8}>
        <Card>
          <Text type="secondary">완료 문제의 약점</Text>
          <div style={{ marginTop: 8 }}>
            {weakestDimensions.length === 0 ? (
              <Text>충분한 데이터가 없습니다</Text>
            ) : (
              weakestDimensions.slice(0, 3).map((d) => (
                <Tag key={d.dimension} color="red">
                  {DIMENSION_LABELS[d.dimension] ?? d.dimension}{" "}
                  {Math.round(d.score)}점
                </Tag>
              ))
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            최근 제출 {recentSubmissions}건 · 평균{" "}
            {averageScore != null ? `${averageScore.toFixed(1)}점` : "데이터 부족"}
          </Text>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card>
          <Text type="secondary">다음 추천 유형</Text>
          <div style={{ marginTop: 8 }}>
            <Text strong style={{ fontSize: 18 }}>
              {recommendedType ?? "추천 준비 중"}
            </Text>
          </div>
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card>
          <Statistic
            title="예상 학습 시간"
            value={estimatedMinutes ?? 0}
            suffix={estimatedMinutes != null ? "분" : "정보 없음"}
          />
        </Card>
      </Col>
    </Row>
  );
}
