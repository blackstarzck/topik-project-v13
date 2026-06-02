"use client";

import { Button, Card, Empty, Space, Tag, Typography } from "antd";
import Link from "next/link";

const { Paragraph, Text } = Typography;

/**
 * B-01 area 3 — 추천/진행 카드.
 *
 * "이어 풀 문제"(primary, recommendation_items 기반)와 "추천 유형"(alternatives)
 * 카드를 실제 추천 데이터(getNextProblemBundle)에서 렌더한다.
 *
 * 제약 조건(description.md): 카드 제목 28자, 본문 2줄, 기본 3개/최대 5개.
 * 예외: 추천 없음/최근 기록 없음은 빈 상태 카드로 대체.
 */

export type DashboardPrimary = {
  problemId: string;
  title: string;
  questionNo: number | null;
  reason: string | null;
  /** recommendation | same_question_no | random — 출처 라벨용. */
  source: "recommendation" | "same_question_no" | "random";
};

export type DashboardAlternative = {
  problemId: string;
  title: string;
  questionNo: number | null;
  reason: string | null;
};

type Props = {
  primary: DashboardPrimary | null;
  alternatives: DashboardAlternative[];
};

const SOURCE_LABEL: Record<DashboardPrimary["source"], string> = {
  recommendation: "맞춤 추천",
  same_question_no: "이어서 같은 유형",
  random: "오늘의 추천",
};

function truncate(title: string, max = 28): string {
  return title.length > max ? `${title.slice(0, max)}…` : title;
}

export function DashboardRecommendations({ primary, alternatives }: Props) {
  // 기본 3개/최대 5개: primary 1 + alternatives 최대 4 → 총 5개 이하.
  const altList = alternatives.slice(0, 4);

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card title="이어 풀 문제">
        {primary ? (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Space size={8} wrap>
              <Tag color="geekblue">{SOURCE_LABEL[primary.source]}</Tag>
              {primary.questionNo != null ? (
                <Tag>{primary.questionNo}번 문항</Tag>
              ) : null}
            </Space>
            <Text strong>{truncate(primary.title)}</Text>
            {primary.reason ? (
              <Paragraph
                type="secondary"
                ellipsis={{ rows: 2 }}
                style={{ margin: 0 }}
              >
                {primary.reason}
              </Paragraph>
            ) : (
              <Paragraph type="secondary" style={{ margin: 0 }}>
                최근 학습 흐름을 따라가는 추천이에요.
              </Paragraph>
            )}
            <Link href={`/practice/problems/${primary.problemId}` as never}>
              <Button type="primary" block>
                이어 풀기
              </Button>
            </Link>
          </Space>
        ) : (
          <Empty description="이어 풀 문제가 아직 없어요. 추천에서 새 문제를 골라보세요.">
            <Link href="/practice/recommendations">
              <Button type="primary">추천 보기</Button>
            </Link>
          </Empty>
        )}
      </Card>

      <Card title="추천 유형">
        {altList.length === 0 ? (
          <Empty description="추천 유형이 아직 없어요. 글쓰기를 제출하면 맞춤 추천이 생겨요." />
        ) : (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            {altList.map((alt) => (
              <Card key={alt.problemId} size="small">
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                  wrap
                >
                  <Space direction="vertical" size={2}>
                    <Tag color="blue">
                      {alt.questionNo != null
                        ? `${alt.questionNo}번 문항`
                        : "추천"}
                    </Tag>
                    <Text strong>{truncate(alt.title)}</Text>
                  </Space>
                  <Link href={`/practice/problems/${alt.problemId}` as never}>
                    <Button>풀기</Button>
                  </Link>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </Space>
  );
}
