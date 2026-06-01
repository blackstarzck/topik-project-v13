"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";

const { Title, Paragraph, Text } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

export type GrowthWeakDimension = {
  dimension: string;
  /** Normalized 0..1 average score. */
  avgScore: number;
  sampleCount: number;
};

export type GrowthRecommendation = {
  problemId: string;
  title: string;
  questionNo: number | null;
};

export type GrowthKpi = {
  totalAttempts: number;
  totalFeedback: number;
  goalAchieved: boolean;
  goalLabel: string;
};

export type GrowthDashboardProps = {
  kpi: GrowthKpi;
  weakDimensions: GrowthWeakDimension[];
  recommendations: GrowthRecommendation[];
  /** True when no goal row exists — KPI/matrix swap to a setup-prompt card. */
  hasGoal: boolean;
};

function dimensionLabel(dimension: string) {
  return DIMENSION_LABELS[dimension] ?? dimension;
}

/**
 * X-02 성장 대시보드 — honest shell.
 *
 * Time-series 성장 차트(description.md area 3)는 아직 준비 중이라 실제 차트 대신
 * 정직한 "준비 중" 안내와 재시도 동선을 보여준다(과대광고 금지). KPI/약점
 * 매트릭스/추천은 이미 수집된 feedback·recommendation 데이터에서 파생한다.
 * 색상만으로 의미를 전달하지 않도록 수치 라벨을 함께 노출한다(area 4 제약).
 */
export function GrowthDashboard({
  kpi,
  weakDimensions,
  recommendations,
  hasGoal,
}: GrowthDashboardProps) {
  const sortedWeak = [...weakDimensions].sort((a, b) => a.avgScore - b.avgScore);
  const leading = sortedWeak[0];
  const leadingLabel = leading ? dimensionLabel(leading.dimension) : null;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          성장 대시보드
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          최근 학습 결과를 바탕으로 성장 지표와 약점을 정리했어요. 자세한 추세
          차트는 준비 중입니다.
        </Paragraph>
      </div>

      {/* area 2 — KPI 카드. 목표 없음/데이터 없음은 설정 유도로 대체. */}
      {hasGoal ? (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card size="small" style={{ height: "100%" }}>
              <Statistic
                title="누적 풀이"
                value={kpi.totalAttempts}
                suffix="회"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ height: "100%" }}>
              <Statistic
                title="받은 피드백"
                value={kpi.totalFeedback}
                suffix="건"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ height: "100%" }}>
              <Statistic
                title="약점 분석"
                value={weakDimensions.length}
                suffix="개 영역"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ height: "100%" }}>
              <Statistic title="목표" value={kpi.goalLabel} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Card>
          <Empty description="학습 목표가 아직 없어요. 목표를 설정하면 성장 지표가 채워집니다.">
            <Link href="/onboarding/learning-goal">
              <Button type="primary">목표 설정하기</Button>
            </Link>
          </Empty>
        </Card>
      )}

      {/* area 3 — 성장 차트. 아직 미구현이라 정직한 준비-중 안내 + 재시도 동선. */}
      <Card title="성장 추세 차트">
        <Alert
          type="info"
          showIcon
          message="추세 차트는 준비 중입니다."
          description="점수·풀이량 추세 그래프는 다음 업데이트에서 제공돼요. 지금은 아래 약점 분석과 추천으로 다음 학습을 이어갈 수 있어요."
        />
      </Card>

      {/* area 4 — 약점 매트릭스. 색상만으로 의미 전달 금지 → 수치 라벨 병기. */}
      <Card title="약점 매트릭스">
        {weakDimensions.length === 0 ? (
          <Empty description="글쓰기를 더 제출하면 약점 분석이 채워져요.">
            <Link href="/practice/problems">
              <Button type="primary">학습 시작</Button>
            </Link>
          </Empty>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {sortedWeak.map((w) => {
              const percent = Math.round(w.avgScore * 100);
              return (
                <div key={w.dimension}>
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Text strong>{dimensionLabel(w.dimension)}</Text>
                    <Text type="secondary">
                      {percent}점 · {w.sampleCount}건
                    </Text>
                  </Space>
                  <Progress
                    percent={percent}
                    showInfo={false}
                    status={percent < 60 ? "exception" : "normal"}
                  />
                </div>
              );
            })}
          </Space>
        )}
      </Card>

      {/* area 5 — 인사이트. 실패 시 기본 학습 팁으로 대체(정직 안내). */}
      <Card title="인사이트">
        {leadingLabel ? (
          <Alert
            type="info"
            showIcon
            message={`${leadingLabel} 영역을 먼저 보완하면 도움이 될 수 있어요.`}
            description="최근 답안에서 낮게 나온 영역을 바탕으로 추정한 안내예요. 실제 약점은 다음 연습 결과에 따라 달라질 수 있습니다."
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="학습 팁"
            description="짧게 자주 쓰는 연습이 점수 향상에 가장 도움이 됩니다. 추천 문제부터 시작해 보세요."
          />
        )}
      </Card>

      {/* area 6 — 하단 요약/추천. 추천 없음이면 문제 목록 CTA만. */}
      <Card title="다음 추천 문제">
        {recommendations.length === 0 ? (
          <Empty description="추천 문제가 아직 없어요.">
            <Link href="/practice/problems">
              <Button type="primary">문제 목록 보기</Button>
            </Link>
          </Empty>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {recommendations.slice(0, 5).map((rec) => (
              <Card key={rec.problemId} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space direction="vertical" size={2}>
                    <Tag color="blue">
                      {rec.questionNo != null ? `${rec.questionNo}번 문항` : "추천"}
                    </Tag>
                    <Text strong>{rec.title}</Text>
                  </Space>
                  <Link href={`/practice/problems/${rec.problemId}` as never}>
                    <Button type="primary">추천 학습 시작</Button>
                  </Link>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
