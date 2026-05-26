"use client";

import { Card, Col, Row, Statistic, Tag, Typography } from "antd";

const { Text } = Typography;

type WeakDimension = { dimension: string; score: number };

type Props = {
  recentSubmissions: number;
  averageScore: number | null;
  weakestDimensions: WeakDimension[];
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
 * Phase 7-D Task 6 (P1-2) — R-02 summary row.
 * IA: docs/IA/17-R-02-next-problem-recommendation/description.md.
 * 3-column: 최근 제출 수 / 평균 점수 / 약점 dimension top 3.
 */
export function SummaryCardRow({
  recentSubmissions,
  averageScore,
  weakestDimensions,
}: Props) {
  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Card>
          <Statistic title="최근 제출" value={recentSubmissions} suffix="건" />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card>
          <Statistic
            title="평균 점수"
            value={averageScore ?? 0}
            suffix={averageScore != null ? "점" : "데이터 부족"}
            precision={1}
          />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card>
          <Text type="secondary">약점 영역</Text>
          <div style={{ marginTop: 8 }}>
            {weakestDimensions.length === 0 ? (
              <Text>충분한 데이터가 없습니다</Text>
            ) : (
              weakestDimensions.map((d) => (
                <Tag key={d.dimension} color="red">
                  {DIMENSION_LABELS[d.dimension] ?? d.dimension} {Math.round(d.score)}점
                </Tag>
              ))
            )}
          </div>
        </Card>
      </Col>
    </Row>
  );
}
