"use client";

import { Alert, Button, Col, Divider, Empty, Row, Space, Spin, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { isValidQuestionNo, type QuestionNo } from "@/lib/practice/types";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import { TypeSelectCards } from "./TypeSelectCards";
import {
  PrimaryRecommendationCard,
  SecondaryRecommendationCard,
} from "./RecommendationItemCards";
import { useRecommendationBundle } from "./recommendations-data";

const { Title, Paragraph, Text } = Typography;

export function RecommendationsView() {
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
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          추천 문제
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          현재 학습 흐름에 맞춘 추천이에요. 유형을 골라 다시 추천을 받을 수 있어요.
        </Paragraph>
      </div>

      {/* C-01 §2 — 유형 탭. 권한 잠금 유형이 생기면 lockedTypes로 잠금 배지 표시. */}
      <ProblemTypeTabs active={active} onChange={updateType} />

      {/* C-01 §3 — 추천 사유: recommendation_runs.reason_summary (run-level 근거). */}
      {bundle.data?.run?.reasonSummary ? (
        <Alert
          type="info"
          showIcon
          message="이렇게 추천했어요"
          description={bundle.data.run.reasonSummary}
        />
      ) : null}

      {bundle.isLoading ? (
        <Spin tip="추천을 불러오는 중이에요">
          <div style={{ minHeight: 80 }} />
        </Spin>
      ) : bundle.error ? (
        // §3 예외 — 추천 계산 실패 시 직접 선택 카드와 재시도 제공.
        <>
          <Alert
            type="error"
            showIcon
            message="추천을 불러오지 못했어요"
            description={
              bundle.error instanceof Error ? bundle.error.message : ""
            }
            action={
              <Button size="small" onClick={() => bundle.refetch()}>
                다시 시도
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
                다른 추천
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
          <Empty description="아직 추천할 문제가 없어요. 아래에서 유형을 직접 골라 시작해 보세요.">
            <Link href={"/practice/problems" as never}>
              <Button type="primary">문제 목록 보기</Button>
            </Link>
          </Empty>
          <TypeSelectCards />
        </>
      )}

      <Text type="secondary" style={{ fontSize: 12 }}>
        추천은 최근 풀이와 취약 영역 분석을 바탕으로 갱신돼요.
      </Text>
    </Space>
  );
}
