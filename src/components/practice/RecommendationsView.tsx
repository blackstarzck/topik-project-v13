"use client";

import { Alert, Button, Col, Row, Space, Spin, Typography } from "antd";
import { ArrowRight, CheckCircle2, Clock3, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { isValidQuestionNo, type QuestionNo } from "@/lib/practice/types";
import { writingQuestionHref } from "@/lib/writing/routes";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import {
  PrimaryRecommendationCard,
  SecondaryRecommendationCard,
} from "./RecommendationItemCards";
import { TypeSelectCards } from "./TypeSelectCards";
import { useRecommendationBundle } from "./recommendations-data";

const { Title, Text } = Typography;

const FALLBACK_META: Record<QuestionNo, { minutes: number }> = {
  51: { minutes: 15 },
  52: { minutes: 25 },
  53: { minutes: 30 },
  54: { minutes: 50 },
};

function FallbackRecommendationPanel({
  questionNo,
  reasonSummary,
}: {
  questionNo: QuestionNo;
  reasonSummary?: string | null;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const typeLabel = tCommon(`questionType${questionNo}`);
  const questionLabel = tCommon("questionNo", { no: questionNo });
  const meta = FALLBACK_META[questionNo];

  return (
    <section className="recommendation-fallback-panel">
      <div className="recommendation-fallback-panel__copy">
        <span className="recommendation-fallback-panel__badge">
          {t("primaryBadge")}
        </span>
        <Title level={2}>
          {t("fallbackHeroTitle", { type: typeLabel })}
        </Title>
        <Text>
          {reasonSummary ?? t("fallbackHeroBody", { type: typeLabel })}
        </Text>
      </div>
      <div className="recommendation-fallback-panel__action">
        <div className="recommendation-fallback-panel__status">
          <span>
            <Clock3 size={18} />
            <small>{t("fallbackHeroTime")}</small>
            <strong>{tCommon("minutes", { minutes: meta.minutes })}</strong>
          </span>
          <span>
            <Target size={18} />
            <small>{t("fallbackHeroDifficulty")}</small>
            <strong>{tCommon("difficultyNormal")}</strong>
          </span>
          <span>
            <CheckCircle2 size={18} />
            <small>{t("fallbackHeroStatus")}</small>
            <strong>{t("fallbackHeroStatusReady")}</strong>
          </span>
        </div>
        <Link href={writingQuestionHref(questionNo) as never}>
          <Button type="primary" size="large" block>
            <span>{t("fallbackHeroCta", { type: questionLabel })}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function RecommendationsView() {
  const t = useTranslations("practice.recommendations");
  const router = useRouter();
  const params = useSearchParams();

  const active = useMemo<QuestionNo | null>(() => {
    const raw = params.get("type");
    if (!raw) return null;
    const parsed = Number(raw);
    return isValidQuestionNo(parsed) ? parsed : null;
  }, [params]);

  const bundle = useRecommendationBundle(active);

  function updateType(next: QuestionNo | null) {
    const search = new URLSearchParams(params.toString());
    if (next == null) search.delete("type");
    else search.set("type", String(next));
    router.replace(
      `/practice/recommendations${search.size ? `?${search.toString()}` : ""}` as never,
    );
  }

  const items = bundle.data?.items ?? [];
  const primary = items[0] ?? null;
  const rest = items.slice(1);
  const fallbackQuestionNo = active ?? primary?.questionNo ?? 51;

  return (
    <Space
      className="recommendations-page"
      orientation="vertical"
      size="large"
    >
      <PageHeader
        className="recommendations-page__header"
        title={t("heading")}
        subtitle={t("subtitle")}
      />

      <div className="recommendations-page__tabs">
        <ProblemTypeTabs active={active} onChange={updateType} />
      </div>

      {bundle.data?.run?.reasonSummary && primary ? (
        <Alert
          className="recommendation-reason-alert"
          type="info"
          showIcon
          title={t("reasonSummaryTitle")}
          description={bundle.data.run.reasonSummary}
        />
      ) : null}

      {bundle.isLoading ? (
        <Spin description={t("loadingTip")}>
          <div className="recommendations-page__loading-space" />
        </Spin>
      ) : bundle.error ? (
        <>
          <Alert
            className="recommendation-reason-alert"
            type="error"
            showIcon
            title={t("loadErrorTitle")}
            description={
              bundle.error instanceof Error ? bundle.error.message : ""
            }
            action={
              <Button size="small" onClick={() => bundle.refetch()}>
                {t("retry")}
              </Button>
            }
          />
          <TypeSelectCards />
        </>
      ) : items.length > 0 ? (
        <>
          {primary ? <PrimaryRecommendationCard card={primary} /> : null}

          {rest.length > 0 ? (
            <section className="recommendation-secondary-section">
              <Title level={4}>{t("otherRecommendations")}</Title>
              <Row gutter={[12, 12]}>
                {rest.map((card) => (
                  <Col key={card.itemId} xs={24} md={12}>
                    <SecondaryRecommendationCard card={card} />
                  </Col>
                ))}
              </Row>
            </section>
          ) : null}

          <TypeSelectCards />
        </>
      ) : (
        <>
          <FallbackRecommendationPanel
            questionNo={fallbackQuestionNo}
            reasonSummary={bundle.data?.run?.reasonSummary}
          />
          <TypeSelectCards />
          <div className="recommendations-page__problem-list-link">
            <Text type="secondary">{t("emptyDescription")}</Text>
            <Link href={"/practice/problems" as never}>
              <Button>{t("viewProblemList")}</Button>
            </Link>
          </div>
        </>
      )}

      <Text
        className="recommendations-page__footer-note"
        type="secondary"
      >
        {t("footerNote")}
      </Text>
    </Space>
  );
}
