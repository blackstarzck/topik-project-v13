"use client";

import { Button, Card, Col, Empty, Row, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { logStudyEvent } from "@/lib/events/study-events";
import { DimensionTabs } from "./DimensionTabs";
import { DiagnosticCard } from "./DiagnosticCard";

const { Title, Paragraph, Text } = Typography;

type WeakDimensionProp = {
  dimension: string;
  averageScore: number;
  sampleCount?: number;
};

type RecommendationProp = {
  problem_id: string;
  title: string;
  question_no: number;
};

type Props = {
  weakDimensions: WeakDimensionProp[];
  recommendations: RecommendationProp[];
  /** ISO timestamp for diagnostic refresh — Phase 7-D Task 7 */
  updatedAt?: string | null;
};

export function WeaknessView({
  weakDimensions,
  recommendations,
  updatedAt,
}: Props) {
  const router = useRouter();

  if (weakDimensions.length === 0) {
    return (
      <Empty
        description="글쓰기를 5건 이상 제출하면 약점 분석이 활성화됩니다."
      >
        <Button
          type="primary"
          onClick={() => router.push("/practice/problems" as never)}
        >
          문제 풀기
        </Button>
      </Empty>
    );
  }

  function handleRecommendationClick(rec: RecommendationProp) {
    void logStudyEvent({
      eventType: "recommendation_clicked",
      problemId: rec.problem_id,
      payload: { source: "weakness" },
    });
    router.push(`/practice/problems/${rec.problem_id}` as never);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          약점 분석
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          최근 글쓰기 결과를 바탕으로 보완이 필요한 영역과 추천 문제를 안내합니다.
        </Paragraph>
      </div>

      {/* Phase 7-D Task 7 — DiagnosticCard + DimensionTabs */}
      <DiagnosticCard
        weakDimensions={weakDimensions}
        updatedAt={updatedAt ?? null}
      />
      <DimensionTabs dimensions={weakDimensions} />

      <Row gutter={[24, 24]}>
        <Col xs={24} md={24}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Title level={4} style={{ marginBottom: 0 }}>
              추천 문제
            </Title>
            {recommendations.length === 0 ? (
              <Empty description="추천 문제가 아직 없습니다." />
            ) : (
              <Row gutter={[16, 16]}>
                {recommendations.map((rec) => (
                  <Col key={rec.problem_id} xs={24}>
                    <Card
                      hoverable
                      onClick={() => handleRecommendationClick(rec)}
                      data-testid={`weakness-rec-${rec.problem_id}`}
                    >
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">{rec.question_no}번 문항</Text>
                        <Text strong>
                          {rec.title.length > 32
                            ? `${rec.title.slice(0, 32)}…`
                            : rec.title}
                        </Text>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
