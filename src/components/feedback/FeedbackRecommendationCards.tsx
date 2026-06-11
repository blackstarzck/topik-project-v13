"use client";

import { Button, Col, Empty, Row, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Paragraph, Text, Title } = Typography;

type Props = {
  /** 이번 제출의 영역별 점수. weakness 순으로 정렬해 상위 3개를 카드로 만든다. */
  dimensions: FeedbackDimensionScoreRow[];
};

/**
 * E-01/E-02 추천 학습 카드 (description region 3).
 * 제약: 추천 3개 이하, 제목 28자, 추천 사유 1줄.
 * 예외: 다음 문제 없음(약점 카드 0개)은 직접 문제 목록 CTA로 대체.
 *
 * 답안의 약점(낮은 점수 또는 weakness_level 높음)을 근거로 실제 추천 카드를
 * 만든다. 카드 클릭은 약점 기반 추천 화면으로 연결한다(추천 엔진 본문은 X-07).
 * 추천 사유 1줄(description region 3 제약). 제목은 28자 이하로 고정.
 */
export function FeedbackRecommendationCards({ dimensions }: Props) {
  const t = useTranslations("feedback.recommendations");
  const router = useRouter();

  // 약점 순 정렬: weakness_level 높은 순 → 점수 낮은 순. 점수가 있는 것만.
  const ranked = [...dimensions]
    .filter((d) => d.score !== null || d.weakness_level !== null)
    .sort((a, b) => {
      const wl = (b.weakness_level ?? 0) - (a.weakness_level ?? 0);
      if (wl !== 0) return wl;
      return (a.score ?? 999) - (b.score ?? 999);
    })
    .slice(0, 3);

  if (ranked.length === 0) {
    // description region 3 예외 — 추천 없음은 문제 목록 CTA로 대체.
    return (
      <AppCard>
        <Title level={5} className="mt-0">
          {t("cardTitle")}
        </Title>
        <Empty description={t("emptyDescription")}>
          <Button
            type="primary"
            onClick={() => router.push("/practice/problems")}
          >
            {t("viewProblemList")}
          </Button>
        </Empty>
      </AppCard>
    );
  }

  return (
    <AppCard>
      <Title level={5} className="mt-0">
        {t("cardTitle")}
      </Title>
      <Paragraph type="secondary" className="mb-3">
        {t("intro")}
      </Paragraph>
      <Row gutter={[12, 12]}>
        {ranked.map((d) => {
          const recoTitle = t(`reco.${d.dimension}.title`);
          const recoReason = t(`reco.${d.dimension}.reason`);
          return (
            <Col key={d.dimension} xs={24} md={8}>
              <AppCard
                size="small"
                hoverable
                onClick={() =>
                  router.push(`/practice/weakness?focus=${d.dimension}`)
                }
                data-testid={`feedback-reco-${d.dimension}`}
                className="h-full"
              >
                <div className="flex w-full flex-col gap-1">
                  <Tag>{t(`label.${d.dimension}`)}</Tag>
                  <Text strong>{recoTitle}</Text>
                  <Text
                    type="secondary"
                    className="block truncate"
                    title={recoReason}
                  >
                    {recoReason}
                  </Text>
                </div>
              </AppCard>
            </Col>
          );
        })}
      </Row>
    </AppCard>
  );
}
