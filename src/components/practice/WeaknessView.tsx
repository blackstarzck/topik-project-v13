"use client";

import {
  Alert,
  Button,
  Col,
  Empty,
  Row,
  Tag,
  Typography,
} from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { logStudyEvent } from "@/lib/events/study-events";
import { consumeRecommendationItem } from "@/lib/practice/consume";
import { writingProblemHref } from "@/lib/writing/routes";
import { AppCard } from "@/components/shared/AppCard";
import { DimensionTabs, type DimensionTabSummaryProp } from "./DimensionTabs";
import { DiagnosticCard } from "./DiagnosticCard";

const { Title, Paragraph, Text } = Typography;
const RECOMMENDATION_TITLE_MAX_LENGTH = 28;
const RECOMMENDATION_CARD_LIMIT = 4;

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
  /** recommendation_items.id — for consume-on-start (RLS owner-update). */
  item_id?: string | null;
  /** X-07 §5 예외 — 유료 잠금 카드(비활성 + 업그레이드 안내). */
  locked?: boolean;
};

type Props = {
  weakDimensions: WeakDimensionProp[];
  recommendations: RecommendationProp[];
  /** ISO timestamp for diagnostic refresh - Phase 7-D Task 7 */
  updatedAt?: string | null;
  /** X-07 §2 — all-four-tab summaries (incl. disabled under-sampled). */
  tabSummaries?: DimensionTabSummaryProp[];
};

/** dimension → practice.common label key. */
const DIMENSION_LABEL_KEYS: Record<string, string> = {
  grammar: "dimGrammar",
  vocab: "dimVocab",
  structure: "dimStructure",
  content: "dimContent",
  expression: "dimExpression",
  topic_fit: "dimTopicFit",
};

/** Dimensions that have a dedicated insight block in practice.weakness.insights. */
const INSIGHT_DIMENSIONS = new Set([
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
]);

function getLeadingWeakDimension(dimensions: WeakDimensionProp[]) {
  return [...dimensions].sort((a, b) => a.averageScore - b.averageScore)[0];
}

function truncateRecommendationTitle(title: string) {
  if (title.length <= RECOMMENDATION_TITLE_MAX_LENGTH) return title;
  return `${title.slice(0, RECOMMENDATION_TITLE_MAX_LENGTH)}...`;
}

export function WeaknessView({
  weakDimensions,
  recommendations,
  updatedAt,
  tabSummaries,
}: Props) {
  const t = useTranslations("practice.weakness");
  const tCommon = useTranslations("practice.common");
  const router = useRouter();
  // dup-click guard: once a start has been kicked off, ignore further clicks.
  const startedRef = useRef(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  function dimensionLabel(dimension: string) {
    return DIMENSION_LABEL_KEYS[dimension]
      ? tCommon(DIMENSION_LABEL_KEYS[dimension] as Parameters<typeof tCommon>[0])
      : dimension;
  }

  /** Localized why/example/strategy for a dimension (falls back to generic).
   * Keys are dynamic per dimension (all present in the catalog); cast to the
   * translator's key type since next-intl can't verify the template literal. */
  function insightFor(dimension: string) {
    const ns = INSIGHT_DIMENSIONS.has(dimension) ? dimension : "fallback";
    return {
      why: t(`insights.${ns}.why` as Parameters<typeof t>[0]),
      example: t(`insights.${ns}.example` as Parameters<typeof t>[0]),
      strategy: t(`insights.${ns}.strategy` as Parameters<typeof t>[0]),
    };
  }

  function recommendationSourceLabel(source?: RecommendationProp["source"]) {
    return source === "tag_fallback"
      ? t("sourceTagFallback")
      : t("sourceRecommendation");
  }

  function recommendationReason(
    rec: RecommendationProp,
    leadingWeakLabel: string,
  ) {
    const explicitReason = rec.reason?.trim();
    if (explicitReason) return explicitReason;
    if (rec.source === "tag_fallback") {
      return t("reasonTagFallback", {
        label: leadingWeakLabel || t("weaknessFallbackLabel"),
      });
    }
    return t("reasonDefault");
  }

  const leadingWeakDimension = getLeadingWeakDimension(weakDimensions);
  const leadingWeakLabel = leadingWeakDimension
    ? dimensionLabel(leadingWeakDimension.dimension)
    : "";
  const leadingInsight = leadingWeakDimension
    ? insightFor(leadingWeakDimension.dimension)
    : null;
  const visibleRecommendations = recommendations.slice(
    0,
    RECOMMENDATION_CARD_LIMIT,
  );

  if (weakDimensions.length === 0) {
    return (
      <Empty description={t("emptyAnalysis")}>
        <Button
          type="primary"
          onClick={() => router.push("/practice/problems" as never)}
        >
          {t("solveProblems")}
        </Button>
      </Empty>
    );
  }

  function handleRecommendationClick(rec: RecommendationProp) {
    if (rec.locked) {
      router.push("/paywall" as never);
      return;
    }
    if (startedRef.current) return; // 중복 실행 차단
    startedRef.current = true;
    setStartingId(rec.problem_id);
    void logStudyEvent({
      eventType: "recommendation_clicked",
      problemId: rec.problem_id,
      payload: { source: "weakness" },
    });
    // recommendation_items.status='consumed' (RLS owner-update, fire-and-forget).
    void consumeRecommendationItem(rec.item_id ?? null);
    router.push(
      writingProblemHref({
        questionNo: rec.question_no,
        problemId: rec.problem_id,
      }) as never,
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Title level={3} className="!mb-1">
          {t("heading")}
        </Title>
        <Paragraph type="secondary" className="!m-0">
          {t("subtitle")}
        </Paragraph>
      </div>

      {/* Phase 7-D Task 7 - DiagnosticCard + DimensionTabs */}
      <DiagnosticCard
        weakDimensions={weakDimensions}
        updatedAt={updatedAt ?? null}
      />
      <DimensionTabs dimensions={weakDimensions} tabSummaries={tabSummaries} />

      {leadingWeakDimension && leadingInsight ? (
        <AppCard title={t("insightCardTitle")}>
          <div className="flex w-full flex-col gap-4">
            <Alert
              showIcon
              type="info"
              title={t("insightHeadline", { label: leadingWeakLabel })}
              description={t("insightDisclaimer")}
            />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <div className="flex flex-col gap-1">
                  <Text strong>{t("insightWhyTitle")}</Text>
                  <Text type="secondary">{leadingInsight.why}</Text>
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div className="flex flex-col gap-1">
                  <Text strong>{t("insightExampleTitle")}</Text>
                  <Text type="secondary">{leadingInsight.example}</Text>
                </div>
              </Col>
              <Col xs={24} md={8}>
                <div className="flex flex-col gap-1">
                  <Text strong>{t("insightStrategyTitle")}</Text>
                  <Text type="secondary">{leadingInsight.strategy}</Text>
                </div>
              </Col>
            </Row>
          </div>
        </AppCard>
      ) : null}

      <Row gutter={[24, 24]}>
        <Col xs={24} md={24}>
          <div className="flex w-full flex-col gap-4">
            <Title level={4} className="!mb-0">
              {t("recommendationsTitle")}
            </Title>
            {recommendations.length === 0 ? (
              <Empty description={t("recommendationsEmpty")} />
            ) : (
              <Row gutter={[16, 16]}>
                {visibleRecommendations.map((rec) => (
                  <Col key={rec.problem_id} xs={24}>
                    <AppCard
                      hoverable={!rec.locked}
                      onClick={
                        rec.locked
                          ? undefined
                          : () => handleRecommendationClick(rec)
                      }
                      data-testid={`weakness-rec-${rec.problem_id}`}
                      className={rec.locked ? "bg-surface opacity-70" : undefined}
                    >
                      <div className="flex w-full flex-col gap-2">
                        <Text type="secondary">
                          {rec.locked ? "🔒 " : ""}
                          {tCommon("questionItem", { no: rec.question_no })}
                        </Text>
                        <Text strong title={rec.title}>
                          {truncateRecommendationTitle(rec.title)}
                        </Text>
                        {rec.locked ? (
                          <div className="flex flex-col gap-1">
                            <Text type="secondary">{t("lockedNotice")}</Text>
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push("/paywall" as never);
                              }}
                              data-testid={`weakness-rec-upgrade-${rec.problem_id}`}
                            >
                              {t("upgradeInfo")}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-1">
                              <Tag>
                                {recommendationSourceLabel(rec.source)}
                              </Tag>
                              <Text
                                type="secondary"
                                title={recommendationReason(
                                  rec,
                                  leadingWeakLabel,
                                )}
                                className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                              >
                                {recommendationReason(rec, leadingWeakLabel)}
                              </Text>
                            </div>
                            <Button
                              type="primary"
                              disabled={
                                startingId != null &&
                                startingId !== rec.problem_id
                              }
                              loading={startingId === rec.problem_id}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRecommendationClick(rec);
                              }}
                            >
                              {t("startRecommendation")}
                            </Button>
                          </>
                        )}
                      </div>
                    </AppCard>
                  </Col>
                ))}
              </Row>
            )}
            <AppCard>
              <div className="flex flex-col gap-2">
                <Text strong>{t("deeperTitle")}</Text>
                <Text type="secondary">{t("deeperBody")}</Text>
                <Button onClick={() => router.push("/paywall" as never)}>
                  {t("deeperCta")}
                </Button>
              </div>
            </AppCard>
          </div>
        </Col>
      </Row>
    </div>
  );
}
