"use client";

import { Alert, Col, Empty, Row, Space, Spin, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { RecommendationCard } from "@/components/learning/RecommendationCard";
import { useProblemRecommendations } from "@/lib/practice/queries";
import { isValidQuestionNo, type QuestionNo } from "@/lib/practice/types";
import { ProblemTypeTabs } from "./ProblemTypeTabs";

const { Title, Paragraph } = Typography;

export function RecommendationsView() {
  const router = useRouter();
  const params = useSearchParams();

  const active = useMemo<QuestionNo | null>(() => {
    const raw = params.get("type");
    if (!raw) return null;
    const parsed = Number(raw);
    return isValidQuestionNo(parsed) ? parsed : null;
  }, [params]);

  const recs = useProblemRecommendations(active);

  function updateType(next: QuestionNo | null) {
    const search = new URLSearchParams(params.toString());
    if (next == null) search.delete("type");
    else search.set("type", String(next));
    router.replace(`/practice/recommendations${search.size ? `?${search.toString()}` : ""}` as never);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          추천 문제
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          현재 학습 흐름에 맞춘 추천이에요. 유형을 골라 다시 추천을 받을 수 있어요.
        </Paragraph>
      </div>

      <ProblemTypeTabs active={active} onChange={updateType} />

      {recs.isLoading ? (
        <Spin />
      ) : recs.error ? (
        <Alert
          type="error"
          message="추천을 불러오지 못했어요"
          description={recs.error instanceof Error ? recs.error.message : ""}
        />
      ) : recs.data && recs.data.length > 0 ? (
        <Row gutter={[16, 16]}>
          {recs.data.map((card) => (
            <Col key={card.itemId} xs={24} md={12}>
              <RecommendationCard
                title={card.title}
                reason={card.reason}
                estimatedMinutes={card.estimatedMinutes}
                ctaHref={
                  card.questionNo
                    ? `/writing/${card.questionNo}`
                    : "/practice/problems"
                }
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="추천이 없습니다. 직접 유형을 선택해 시작해보세요." />
      )}
    </Space>
  );
}
