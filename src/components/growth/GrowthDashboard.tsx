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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { writingProblemHref } from "@/lib/writing/routes";
import { GrowthTrendChart, type GrowthTrendPoint } from "./GrowthTrendChart";
import { GrowthLockedReport } from "./GrowthLockedReport";
import { buildGrowthInsights } from "./insights";

const { Title, Paragraph, Text } = Typography;

// dimension 코드 목록. 라벨 문구는 growth.dashboard.dimension.* 카탈로그에서
// t()로 해석한다(색상만으로 의미 전달 금지 → 한글 라벨 병기).
const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
] as const;

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

// next-intl 키 타입을 growth.dashboard 네임스페이스로 좁힌다. 동적 dimension 키
// (t(`dimension.${code}`))는 strict 타이핑이 bare string 을 거부하므로 호출부에서
// 캐스트한다.
type DashboardTranslate = ReturnType<typeof useTranslations<"growth.dashboard">>;

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
  const t = useTranslations("growth.dashboard");
  const tInsights = useTranslations("growth.insights");
  const router = useRouter();

  // dimension 코드를 카탈로그 라벨로. 동적 키라 캐스트가 필요하다.
  const dimensionLabel = (dimension: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(dimension)
      ? t(`dimension.${dimension}` as Parameters<DashboardTranslate>[0])
      : dimension;

  // 개선률 KPI 표시 텍스트 + 색상. ICU 리프로 부호/퍼센트를 해석한다.
  const deltaSuffix = (
    pct: number | null,
  ): { text: string; color: string | undefined } => {
    if (pct == null)
      return { text: t("kpi.improvementNoData"), color: undefined };
    if (pct > 0)
      return {
        text: t("kpi.improvementUp", { pct: Math.round(pct) }),
        color: "#3f8600",
      };
    if (pct < 0)
      return {
        text: t("kpi.improvementDown", { pct: Math.abs(Math.round(pct)) }),
        color: "#cf1322",
      };
    return { text: t("kpi.improvementNone"), color: undefined };
  };

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
          {t("heading")}
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t("subheading")}
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
                    title={t("kpi.averageScore")}
                    value={kpi.averageScore != null ? Math.round(kpi.averageScore) : "—"}
                    suffix={kpi.averageScore != null ? t("kpi.pointSuffix") : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("kpi.averageScoreHint")}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic
                    title={t("kpi.attempts")}
                    value={kpi.totalAttempts}
                    suffix={t("kpi.attemptsSuffix")}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("kpi.attemptsHint")}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic
                    title={t("kpi.improvement")}
                    value={improvement.text}
                    valueStyle={improvement.color ? { color: improvement.color } : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("kpi.improvementHint")}
                  </Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: "100%" }}>
                  <Statistic
                    title={t("kpi.goalAchievement")}
                    value={kpi.goalAchievementPct != null ? kpi.goalAchievementPct : "—"}
                    suffix={kpi.goalAchievementPct != null ? "%" : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t("kpi.goalLabel", { goal: kpi.goalLabel })}
                  </Text>
                </Card>
              </Col>
            </Row>
          ) : (
            <Card>
              <Empty description={t("noGoal.description")}>
                <Link href="/onboarding/learning-goal">
                  <Button type="primary">{t("noGoal.cta")}</Button>
                </Link>
              </Empty>
            </Card>
          )}

          {/* area 3 — 성장 차트(recharts 시계열). */}
          <GrowthTrendChart points={trendPoints} onRetry={() => router.refresh()} />

          {/* area 4 — 약점 매트릭스. 색상만으로 의미 전달 금지 → 수치 라벨 병기. */}
          <Card title={t("weakness.title")}>
            {weakDimensions.length === 0 ? (
              <Empty description={t("weakness.empty")}>
                <Link href="/practice/problems">
                  <Button type="primary">{t("weakness.startCta")}</Button>
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
                          {t("weakness.scoreSample", {
                            score: percent,
                            count: w.sampleCount,
                          })}
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

          {/* area 5 — 인사이트. 실제 수치 근거(insights.ts), 3개 이하·60자 이하.
              insights.ts 가 키+ICU 변수만 만들고, 여기서 t()로 문구를 해석한다. */}
          <Card title={t("insights.title")}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {insights.map((insight, idx) => (
                <Alert
                  key={idx}
                  type="info"
                  showIcon
                  message={tInsights(
                    insight.key as Parameters<typeof tInsights>[0],
                    insight.values,
                  )}
                />
              ))}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("insights.disclaimer")}
              </Text>
            </Space>
          </Card>

          {/* area 6 — 하단 요약/추천. 추천 없음이면 최근 완료 요약 + 문제 목록 CTA만. */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title={t("recent.title")}>
                {recentCompleted.length === 0 ? (
                  <Empty description={t("recent.empty")} />
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
                            {t("recent.view")}
                          </Link>,
                        ]}
                      >
                        <Tag>
                          {item.questionNo != null
                            ? t("recent.questionNo", { no: item.questionNo })
                            : "—"}
                        </Tag>
                        <span style={{ marginLeft: 8 }}>
                          {t("recent.scoreLabel")}{" "}
                          <strong>
                            {item.scoreTotal != null
                              ? t("recent.scoreValue", {
                                  score: Math.round(item.scoreTotal),
                                })
                              : t("recent.scorePending")}
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
              <Card title={t("recommend.title")}>
                {recommendations.length === 0 ? (
                  <Empty description={t("recommend.empty")}>
                    <Link href="/practice/problems">
                      <Button type="primary">{t("recommend.listCta")}</Button>
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
                                ? t("recommend.questionNo", {
                                    no: rec.questionNo,
                                  })
                                : t("recommend.questionFallback")}
                            </Tag>
                            <Text strong>{rec.title}</Text>
                          </Space>
                          <Link
                            href={
                              writingProblemHref({
                                questionNo: rec.questionNo,
                                problemId: rec.problemId,
                              }) as never
                            }
                          >
                            <Button type="primary">
                              {t("recommend.startCta")}
                            </Button>
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
