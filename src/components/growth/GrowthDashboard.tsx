"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GrowthTrendChart, type GrowthTrendPoint } from "./GrowthTrendChart";
import { GrowthLockedReport } from "./GrowthLockedReport";
import { buildGrowthInsights } from "./insights";

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

export type GrowthRecentCompleted = {
  submissionId: string;
  questionNo: number | null;
  scoreTotal: number | null;
  generatedAt: string;
};

export type GrowthKpi = {
  /** 0~100 정규화 평균 점수, null이면 미설정. */
  averageScore: number | null;
  totalAttempts: number;
  /** 개선률(%) — 최근 절반 vs 이전 절반 점수 변화, null이면 비교 불가. */
  improvementPct: number | null;
  /** 목표 달성률(%) — 목표 등급 대비, null이면 목표 없음. */
  goalAchievementPct: number | null;
  goalLabel: string;
};

export type GrowthDashboardProps = {
  kpi: GrowthKpi;
  weakDimensions: GrowthWeakDimension[];
  recommendations: GrowthRecommendation[];
  trendPoints: GrowthTrendPoint[];
  recentCompleted: GrowthRecentCompleted[];
  /** 연속 학습일 (인사이트 근거). */
  streakDays: number;
  /** 최근 풀이 수 (인사이트 근거). */
  recentVolume: number;
  /** True when no goal row exists — KPI/matrix swap to a setup-prompt card. */
  hasGoal: boolean;
  /** 무료 플랜이면 상세 리포트 잠금. */
  reportLocked: boolean;
  planLabel: string | null;
};

function dimensionLabel(dimension: string) {
  return DIMENSION_LABELS[dimension] ?? dimension;
}

function deltaSuffix(pct: number | null): {
  text: string;
  color: string | undefined;
} {
  if (pct == null) return { text: "비교 데이터 부족", color: undefined };
  if (pct > 0) return { text: `▲ ${Math.round(pct)}%`, color: "#3f8600" };
  if (pct < 0) return { text: `▼ ${Math.abs(Math.round(pct))}%`, color: "#cf1322" };
  return { text: "변화 없음", color: undefined };
}

/**
 * X-02 성장 대시보드.
 *
 * - area 2 KPI 카드 4개 고정: 평균 점수 / 풀이 수 / 개선률 / 목표 달성률.
 *   수치·증감·기간을 같은 순서로 표시(제약 조건). 데이터 없음/목표 없음은
 *   설정 유도 카드로 대체.
 * - area 3 성장 차트: recharts 시계열(점수·풀이량), 기간 필터 4개·범례 2개.
 * - area 4 약점 매트릭스: 색상만으로 의미 전달 금지 → 수치 라벨 병기.
 * - area 5 인사이트: 실제 수치 근거, 3개 이하·60자 이하(insights.ts).
 * - area 6 하단 요약/추천: 최근 완료 문제 + 다음 추천(5개 이하).
 * - area 1 예외: 무료 플랜은 상세 리포트 잠금 + 업그레이드 CTA.
 */
export function GrowthDashboard({
  kpi,
  weakDimensions,
  recommendations,
  trendPoints,
  recentCompleted,
  streakDays,
  recentVolume,
  hasGoal,
  reportLocked,
  planLabel,
}: GrowthDashboardProps) {
  const router = useRouter();
  const sortedWeak = [...weakDimensions].sort((a, b) => a.avgScore - b.avgScore);
  const leading = sortedWeak[0];
  const leadingLabel = leading ? dimensionLabel(leading.dimension) : null;

  const insights = buildGrowthInsights({
    averageScore: kpi.averageScore,
    recentVolume,
    scoreDeltaPct: kpi.improvementPct,
    weakestDimensionLabel: leadingLabel,
    streakDays,
  });

  const improvement = deltaSuffix(kpi.improvementPct);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          성장 대시보드
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          최근 학습 결과를 바탕으로 성장 지표와 약점을 정리했어요.
        </Paragraph>
      </div>

      {/* area 1 예외 — 권한 없는 리포트 잠금 + 업그레이드 CTA. */}
      {reportLocked ? (
        <Card>
          <GrowthLockedReport planLabel={planLabel} />
        </Card>
      ) : (
        <>
          {/* area 2 — KPI 카드 4개 고정. 목표/데이터 없음은 설정 유도. */}
          {hasGoal ? (
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic
                    title="평균 점수"
                    value={kpi.averageScore != null ? Math.round(kpi.averageScore) : "—"}
                    suffix={kpi.averageScore != null ? "점" : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    100점 만점 기준
                  </Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic title="풀이 수" value={kpi.totalAttempts} suffix="회" />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    누적 기준
                  </Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic
                    title="개선률"
                    value={improvement.text}
                    valueStyle={improvement.color ? { color: improvement.color } : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    최근 vs 이전
                  </Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic
                    title="목표 달성률"
                    value={kpi.goalAchievementPct != null ? kpi.goalAchievementPct : "—"}
                    suffix={kpi.goalAchievementPct != null ? "%" : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    목표 {kpi.goalLabel}
                  </Text>
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

          {/* area 3 — 성장 차트(recharts 시계열). */}
          <GrowthTrendChart points={trendPoints} onRetry={() => router.refresh()} />

          {/* area 4 — 약점 매트릭스. 색상만으로 의미 전달 금지 → 수치 라벨 병기. */}
          <Card title="약점 매트릭스">
            {weakDimensions.length === 0 ? (
              <Empty description="글쓰기를 더 제출하면 약점 분석이 채워져요. 지금은 최근 답안 기준으로 안내해요.">
                <Link href="/practice/problems">
                  <Button type="primary">학습 시작</Button>
                </Link>
              </Empty>
            ) : (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {sortedWeak.slice(0, 6).map((w) => {
                  const percent = Math.round(w.avgScore * 100);
                  return (
                    <div key={w.dimension}>
                      <Space
                        style={{ width: "100%", justifyContent: "space-between" }}
                      >
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

          {/* area 5 — 인사이트. 실제 수치 근거(insights.ts), 3개 이하·60자 이하. */}
          <Card title="인사이트">
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {insights.map((sentence, idx) => (
                <Alert
                  key={idx}
                  type="info"
                  showIcon
                  message={sentence}
                />
              ))}
              <Text type="secondary" style={{ fontSize: 12 }}>
                실제 점수·풀이 기록에서 계산한 요약이에요. 약점은 다음 연습 결과에
                따라 달라질 수 있습니다.
              </Text>
            </Space>
          </Card>

          {/* area 6 — 하단 요약/추천. 추천 없음이면 최근 완료 요약 + 문제 목록 CTA만. */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="최근 완료 문제">
                {recentCompleted.length === 0 ? (
                  <Empty description="아직 완료한 문제가 없어요." />
                ) : (
                  <List
                    size="small"
                    dataSource={recentCompleted.slice(0, 5)}
                    renderItem={(item) => (
                      <List.Item
                        key={item.submissionId}
                        actions={[
                          <Link
                            key="view"
                            href={`/writing/feedback/long/${item.submissionId}` as never}
                          >
                            보기
                          </Link>,
                        ]}
                      >
                        <Tag>
                          {item.questionNo != null ? `${item.questionNo}번` : "—"}
                        </Tag>
                        <span style={{ marginLeft: 8 }}>
                          점수{" "}
                          <strong>
                            {item.scoreTotal != null
                              ? `${Math.round(item.scoreTotal)}점`
                              : "대기"}
                          </strong>
                        </span>
                        <Text
                          type="secondary"
                          style={{ marginLeft: 12, fontSize: 12 }}
                        >
                          {new Date(item.generatedAt).toLocaleDateString("ko-KR")}
                        </Text>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="다음 추천 문제">
                {recommendations.length === 0 ? (
                  <Empty description="추천 문제가 아직 없어요.">
                    <Link href="/practice/problems">
                      <Button type="primary">문제 목록 보기</Button>
                    </Link>
                  </Empty>
                ) : (
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ width: "100%" }}
                  >
                    {recommendations.slice(0, 5).map((rec) => (
                      <Card key={rec.problemId} size="small">
                        <Space
                          style={{
                            width: "100%",
                            justifyContent: "space-between",
                          }}
                          wrap
                        >
                          <Space direction="vertical" size={2}>
                            <Tag color="blue">
                              {rec.questionNo != null
                                ? `${rec.questionNo}번 문항`
                                : "추천"}
                            </Tag>
                            <Text strong>{rec.title}</Text>
                          </Space>
                          <Link
                            href={`/practice/problems/${rec.problemId}` as never}
                          >
                            <Button type="primary">추천 학습 시작</Button>
                          </Link>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Space>
  );
}
