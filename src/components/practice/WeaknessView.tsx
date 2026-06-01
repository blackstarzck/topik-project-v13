"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { logStudyEvent } from "@/lib/events/study-events";
import { DimensionTabs } from "./DimensionTabs";
import { DiagnosticCard } from "./DiagnosticCard";

const { Title, Paragraph, Text } = Typography;
const RECOMMENDATION_TITLE_MAX_LENGTH = 28;

type WeakDimensionProp = {
  dimension: string;
  averageScore: number;
  sampleCount?: number;
};

type RecommendationProp = {
  problem_id: string;
  title: string;
  question_no: number;
  reason?: string | null;
  source?: "recommendation" | "tag_fallback";
};

type Props = {
  weakDimensions: WeakDimensionProp[];
  recommendations: RecommendationProp[];
  /** ISO timestamp for diagnostic refresh - Phase 7-D Task 7 */
  updatedAt?: string | null;
};

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  topic: "주제 적합성",
};

const DIMENSION_INSIGHTS: Record<
  string,
  { why: string; example: string; strategy: string }
> = {
  grammar: {
    why: "문장 규칙이 흔들리면 좋은 생각도 덜 정확하게 전달될 수 있어요.",
    example:
      "시제, 조사, 연결어가 답안 안에서 섞이는 경우가 자주 보일 수 있어요.",
    strategy:
      "짧은 문장으로 고쳐 쓰고, 같은 표현을 다른 시제로 다시 써 보세요.",
  },
  vocab: {
    why: "단어 선택이 좁으면 같은 의미를 반복하게 되어 답안의 설득력이 약해질 수 있어요.",
    example:
      "쉬운 단어만 반복하거나 문맥에 덜 맞는 표현을 고르는 경우가 있을 수 있어요.",
    strategy: "추천 문제를 풀며 비슷한 뜻의 표현을 2개씩 함께 정리해 보세요.",
  },
  structure: {
    why: "구성이 흐트러지면 주장과 근거의 관계가 읽는 사람에게 덜 분명해질 수 있어요.",
    example:
      "도입, 근거, 마무리의 순서가 바뀌거나 한 문단에 여러 생각이 섞일 수 있어요.",
    strategy: "문장을 쓰기 전에 핵심 주장 1개와 근거 2개를 먼저 적어 보세요.",
  },
  topic: {
    why: "주제에서 벗어나면 문장이 맞아도 점수로 이어지기 어려울 수 있어요.",
    example:
      "질문이 요구한 조건보다 배경 설명이 길어지는 경우가 있을 수 있어요.",
    strategy:
      "문제를 다시 읽고 필수 조건을 체크한 뒤 답안을 짧게 다듬어 보세요.",
  },
};

function getDimensionLabel(dimension: string) {
  return DIMENSION_LABELS[dimension] ?? dimension;
}

function getLeadingWeakDimension(dimensions: WeakDimensionProp[]) {
  return [...dimensions].sort((a, b) => a.averageScore - b.averageScore)[0];
}

function getFallbackInsight() {
  return {
    why: "최근 답안에서 낮게 나온 영역이라 먼저 확인하면 도움이 될 수 있어요.",
    example: "같은 유형의 실수가 반복되는지 살펴볼 필요가 있어요.",
    strategy: "추천 문제를 풀고 답안을 한 번 더 고쳐 써 보세요.",
  };
}

function getRecommendationSourceLabel(source?: RecommendationProp["source"]) {
  if (source === "tag_fallback") {
    return "약점 태그 기반";
  }
  return "추천 근거";
}

function getRecommendationReason(
  rec: RecommendationProp,
  leadingWeakLabel: string,
) {
  const explicitReason = rec.reason?.trim();
  if (explicitReason) return explicitReason;

  if (rec.source === "tag_fallback") {
    return `${leadingWeakLabel || "약점"} 영역과 관련된 문항이라 우선 추천합니다.`;
  }

  return "최근 약점 분석과 겹치는 문제라 우선 연습할 수 있어요.";
}

function truncateRecommendationTitle(title: string) {
  if (title.length <= RECOMMENDATION_TITLE_MAX_LENGTH) return title;
  return `${title.slice(0, RECOMMENDATION_TITLE_MAX_LENGTH)}...`;
}

export function WeaknessView({
  weakDimensions,
  recommendations,
  updatedAt,
}: Props) {
  const router = useRouter();
  const leadingWeakDimension = getLeadingWeakDimension(weakDimensions);
  const leadingWeakLabel = leadingWeakDimension
    ? getDimensionLabel(leadingWeakDimension.dimension)
    : "";
  const leadingInsight = leadingWeakDimension
    ? (DIMENSION_INSIGHTS[leadingWeakDimension.dimension] ??
      getFallbackInsight())
    : null;

  if (weakDimensions.length === 0) {
    return (
      <Empty description="글쓰기를 5건 이상 제출하면 약점 분석이 활성화됩니다.">
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
          최근 글쓰기 결과를 바탕으로 보완이 필요한 영역과 추천 문제를
          안내합니다.
        </Paragraph>
      </div>

      {/* Phase 7-D Task 7 - DiagnosticCard + DimensionTabs */}
      <DiagnosticCard
        weakDimensions={weakDimensions}
        updatedAt={updatedAt ?? null}
      />
      <DimensionTabs dimensions={weakDimensions} />

      {leadingWeakDimension && leadingInsight ? (
        <Card title="약점 인사이트">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              showIcon
              type="info"
              message={`${leadingWeakLabel} 영역을 먼저 볼 수 있어요.`}
              description="최근 답안에서 보이는 경향을 바탕으로 추정한 안내예요. 실제 약점은 다음 연습 결과에 따라 달라질 수 있습니다."
            />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Space direction="vertical" size={4}>
                  <Text strong>왜 이 영역을 먼저 보나요?</Text>
                  <Text type="secondary">{leadingInsight.why}</Text>
                </Space>
              </Col>
              <Col xs={24} md={8}>
                <Space direction="vertical" size={4}>
                  <Text strong>자주 보이는 예</Text>
                  <Text type="secondary">{leadingInsight.example}</Text>
                </Space>
              </Col>
              <Col xs={24} md={8}>
                <Space direction="vertical" size={4}>
                  <Text strong>연습 전략</Text>
                  <Text type="secondary">{leadingInsight.strategy}</Text>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>
      ) : null}

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
                      <Space
                        direction="vertical"
                        size="small"
                        style={{ width: "100%" }}
                      >
                        <Text type="secondary">{rec.question_no}번 문항</Text>
                        <Text strong title={rec.title}>
                          {truncateRecommendationTitle(rec.title)}
                        </Text>
                        <Space direction="vertical" size={2}>
                          <Tag color="blue">
                            {getRecommendationSourceLabel(rec.source)}
                          </Tag>
                          <Text
                            type="secondary"
                            title={getRecommendationReason(
                              rec,
                              leadingWeakLabel,
                            )}
                            style={{
                              display: "block",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getRecommendationReason(rec, leadingWeakLabel)}
                          </Text>
                        </Space>
                        <Button
                          type="primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRecommendationClick(rec);
                          }}
                        >
                          추천 학습 시작
                        </Button>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
            <Card>
              <Space direction="vertical" size={8}>
                <Text strong>더 깊은 추천 보기</Text>
                <Text type="secondary">
                  더 자세한 추천 화면은 준비 중입니다. 결제 기능은 아직 준비
                  중이라 실제 결제나 구독은 진행되지 않아요.
                </Text>
                <Button onClick={() => router.push("/paywall" as never)}>
                  안내 화면 보기
                </Button>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
