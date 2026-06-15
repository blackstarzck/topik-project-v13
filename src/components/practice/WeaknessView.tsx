"use client";

import { Alert, Button, Col, Empty, Row, Tag, Typography } from "antd";
import { ArrowRight, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { logStudyEvent } from "@/lib/events/study-events";
import { consumeRecommendationItem } from "@/lib/practice/consume";
import { writingProblemHref } from "@/lib/writing/routes";
import { AppCard } from "@/components/shared/AppCard";
import { SelectableAppCard } from "@/components/shared/SelectableAppCard";
import { DimensionTabs, type DimensionTabSummaryProp } from "./DimensionTabs";
import { DiagnosticCard } from "./DiagnosticCard";

const { Title, Text } = Typography;
const RECOMMENDATION_TITLE_MAX_LENGTH = 28;
const RECOMMENDATION_CARD_LIMIT = 4;
const CARD_ACTION_CLASS_NAMES = {
  actions: "app-card-footer-actions",
};

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
  estimated_minutes?: number | null;
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
  const visibleRecommendations = recommendations.slice(
    0,
    RECOMMENDATION_CARD_LIMIT,
  );
  // dup-click guard: once a start has been kicked off, ignore further clicks.
  const startedRef = useRef(false);
  const [selectedId, setSelectedId] = useState(
    visibleRecommendations[0]?.problem_id ?? null,
  );
  const [startingId, setStartingId] = useState<string | null>(null);

  function dimensionLabel(dimension: string) {
    return DIMENSION_LABEL_KEYS[dimension]
      ? tCommon(
          DIMENSION_LABEL_KEYS[dimension] as Parameters<typeof tCommon>[0],
        )
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
  const selectedRecommendation =
    visibleRecommendations.find((rec) => rec.problem_id === selectedId) ??
    visibleRecommendations[0] ??
    null;
  const selectedRank = selectedRecommendation
    ? visibleRecommendations.findIndex(
        (rec) => rec.problem_id === selectedRecommendation.problem_id,
      ) + 1
    : 0;

  function handleRecommendationClick(rec: RecommendationProp) {
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

  function handlePrimaryCta() {
    if (!selectedRecommendation) {
      router.push("/practice/problems" as never);
      return;
    }
    handleRecommendationClick(selectedRecommendation);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {weakDimensions.length === 0 ? (
        <Alert
          showIcon
          type="info"
          title={t("emptyAnalysis")}
          description={t("emptyAnalysisHint")}
        />
      ) : null}

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
              <AppCard>
                <Empty description={t("recommendationsEmpty")}>
                  <Button
                    type="primary"
                    icon={<ListChecks size={16} />}
                    onClick={() => router.push("/practice/problems" as never)}
                  >
                    {t("recommendationsEmptyCta")}
                  </Button>
                </Empty>
              </AppCard>
            ) : (
              <Row gutter={[16, 16]}>
                {visibleRecommendations.map((rec) => {
                  const isSelected =
                    selectedRecommendation?.problem_id === rec.problem_id;
                  return (
                    <Col key={rec.problem_id} xs={24} md={12} xl={6}>
                      <SelectableAppCard
                        hoverable
                        selected={isSelected}
                        onSelect={() => setSelectedId(rec.problem_id)}
                        title={truncateRecommendationTitle(rec.title)}
                        extra={
                          <Tag>
                            {tCommon("questionItem", { no: rec.question_no })}
                          </Tag>
                        }
                        actions={[
                          <Button
                            key="select"
                            disabled={isSelected}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(rec.problem_id);
                            }}
                          >
                            {isSelected
                              ? t("selectedRecommendation")
                              : t("selectRecommendation")}
                          </Button>,
                        ]}
                        data-testid={`weakness-rec-${rec.problem_id}`}
                      >
                        <div className="flex w-full flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            <Tag>{recommendationSourceLabel(rec.source)}</Tag>
                            {rec.estimated_minutes != null ? (
                              <Tag>
                                {t("estimatedMinutes", {
                                  minutes: rec.estimated_minutes,
                                })}
                              </Tag>
                            ) : null}
                          </div>
                          <Text
                            type="secondary"
                            title={recommendationReason(rec, leadingWeakLabel)}
                            className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                          >
                            {recommendationReason(rec, leadingWeakLabel)}
                          </Text>
                        </div>
                      </SelectableAppCard>
                    </Col>
                  );
                })}
              </Row>
            )}
            <AppCard
              title={t("nextStepTitle")}
              classNames={CARD_ACTION_CLASS_NAMES}
              actions={[
                <Button
                  key="start"
                  type="primary"
                  icon={
                    selectedRecommendation ? (
                      <ArrowRight size={16} />
                    ) : (
                      <ListChecks size={16} />
                    )
                  }
                  loading={
                    selectedRecommendation
                      ? startingId === selectedRecommendation.problem_id
                      : false
                  }
                  disabled={
                    selectedRecommendation
                      ? startingId != null &&
                        startingId !== selectedRecommendation.problem_id
                      : false
                  }
                  onClick={handlePrimaryCta}
                  data-testid="weakness-primary-start"
                >
                  {selectedRecommendation
                    ? t("startSelectedRecommendation", {
                        rank: selectedRank,
                      })
                    : t("recommendationsEmptyCta")}
                </Button>,
              ]}
            >
              <div className="flex flex-col gap-2">
                <Text type="secondary">
                  {selectedRecommendation
                    ? t("nextStepBody", {
                        title: truncateRecommendationTitle(
                          selectedRecommendation.title,
                        ),
                      })
                    : t("nextStepFallbackBody")}
                </Text>
              </div>
            </AppCard>
          </div>
        </Col>
      </Row>
    </div>
  );
}
