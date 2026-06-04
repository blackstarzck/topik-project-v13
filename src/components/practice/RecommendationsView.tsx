"use client";

import { Alert, Button, Col, Divider, Empty, Row, Space, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { isValidQuestionNo, type QuestionNo } from "@/lib/practice/types";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import { TypeSelectCards } from "./TypeSelectCards";
import {
  PrimaryRecommendationCard,
  SecondaryRecommendationCard,
} from "./RecommendationItemCards";
import { useRecommendationBundle } from "./recommendations-data";

const { Title, Text } = Typography;

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

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <PageHeader title={t("heading")} subtitle={t("subtitle")} />

      {/* C-01 §2 — 유형 탭. 권한 잠금 유형이 생기면 lockedTypes로 잠금 배지 표시. */}
      <ProblemTypeTabs active={active} onChange={updateType} />

      {/* C-01 §3 — 추천 사유: recommendation_runs.reason_summary (run-level 근거). */}
      {bundle.data?.run?.reasonSummary ? (
        <Alert
          type="info"
          showIcon
          title={t("reasonSummaryTitle")}
          description={bundle.data.run.reasonSummary}
        />
      ) : null}

      {bundle.isLoading ? (
        <Spin description={t("loadingTip")}>
          <div style={{ minHeight: 80 }} />
        </Spin>
      ) : bundle.error ? (
        // §3 예외 — 추천 계산 실패 시 직접 선택 카드와 재시도 제공.
        <>
          <Alert
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
          {/* §3 — 대표 추천 1개를 크게. */}
          {primary ? <PrimaryRecommendationCard card={primary} /> : null}

          {rest.length > 0 ? (
            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                {t("otherRecommendations")}
              </Title>
              <Row gutter={[12, 12]}>
                {rest.map((card) => (
                  <Col key={card.itemId} xs={24} md={12}>
                    <SecondaryRecommendationCard card={card} />
                  </Col>
                ))}
              </Row>
            </div>
          ) : null}

          <Divider style={{ margin: "8px 0" }} />
          {/* §4 — 추천 외 직접 선택 카드. */}
          <TypeSelectCards />
        </>
      ) : (
        // 피드백 — 빈 결과 안내 + 직접 유형 선택 동선(§4 카드).
        <>
          <Empty description={t("emptyDescription")}>
            <Link href={"/practice/problems" as never}>
              <Button type="primary">{t("viewProblemList")}</Button>
            </Link>
          </Empty>
          <TypeSelectCards />
        </>
      )}

      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("footerNote")}
      </Text>
    </Space>
  );
}
