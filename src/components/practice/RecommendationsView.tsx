"use client";

import { Alert, Button, Col, Empty, Row, Space, Spin, Typography } from "antd";
import Link from "next/link";
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
        <Spin tip="추천을 불러오는 중이에요" />
      ) : recs.error ? (
        // description.md §3 예외: 추천 계산 실패 시 직접 선택 카드와 재시도 제공.
        <Alert
          type="error"
          message="추천을 불러오지 못했어요"
          description={recs.error instanceof Error ? recs.error.message : ""}
          action={
            <Space direction="vertical">
              <Button size="small" onClick={() => recs.refetch()}>
                다시 시도
              </Button>
              <Link href={"/practice/problems" as never}>
                <Button size="small" type="primary">
                  문제 풀기 시작
                </Button>
              </Link>
            </Space>
          }
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
        // description.md 피드백: 빈 결과 안내 + 직접 유형 선택 시작 동선.
        <Empty description="아직 추천할 문제가 없어요. 직접 유형을 골라 시작해 보세요.">
          <Link href={"/practice/problems" as never}>
            <Button type="primary">문제 풀기 시작</Button>
          </Link>
        </Empty>
      )}
    </Space>
  );
}
