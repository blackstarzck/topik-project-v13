"use client";

import { Button, Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Paragraph, Text, Title } = Typography;

/** 추천 사유 1줄(description region 3 제약). 제목은 28자 이하로 고정. */
const DIMENSION_RECO: Record<
  FeedbackDimensionScoreRow["dimension"],
  { title: string; reason: string }
> = {
  grammar: {
    title: "문법 집중 연습",
    reason: "문법 정확도를 높이면 점수가 빠르게 오를 수 있어요.",
  },
  vocab: {
    title: "어휘 다듬기 연습",
    reason: "표현을 다양하게 쓰면 설득력이 올라가요.",
  },
  structure: {
    title: "글 구성 연습",
    reason: "주장과 근거 순서를 정리하면 글이 또렷해져요.",
  },
  content: {
    title: "내용 보강 연습",
    reason: "예시와 근거를 더하면 주장에 힘이 실려요.",
  },
  expression: {
    title: "표현력 연습",
    reason: "같은 뜻을 여러 방식으로 쓰는 연습이 도움이 돼요.",
  },
  topic_fit: {
    title: "주제 적합성 연습",
    reason: "질문 조건을 다시 확인하면 점수로 이어지기 쉬워요.",
  },
};

const DIMENSION_LABEL: Record<FeedbackDimensionScoreRow["dimension"], string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

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
 */
export function FeedbackRecommendationCards({ dimensions }: Props) {
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
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          추천 학습
        </Title>
        <Empty description="이번 답안에서는 추천할 약점 영역을 찾지 못했어요.">
          <Button
            type="primary"
            onClick={() => router.push("/practice/problems")}
          >
            문제 목록 보기
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Card>
      <Title level={5} style={{ marginTop: 0 }}>
        추천 학습
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        이번 답안에서 보강하면 좋은 영역을 추천해요.
      </Paragraph>
      <Row gutter={[12, 12]}>
        {ranked.map((d) => {
          const reco = DIMENSION_RECO[d.dimension];
          return (
            <Col key={d.dimension} xs={24} md={8}>
              <Card
                size="small"
                hoverable
                onClick={() =>
                  router.push(`/practice/weakness?focus=${d.dimension}`)
                }
                data-testid={`feedback-reco-${d.dimension}`}
                style={{ height: "100%" }}
              >
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Tag color="blue">{DIMENSION_LABEL[d.dimension]}</Tag>
                  <Text strong>{reco.title}</Text>
                  <Text
                    type="secondary"
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={reco.reason}
                  >
                    {reco.reason}
                  </Text>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}
