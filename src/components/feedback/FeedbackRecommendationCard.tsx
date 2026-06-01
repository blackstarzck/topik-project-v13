"use client";

import { Button, Card, Space, Typography } from "antd";
import { useRouter } from "next/navigation";

const { Paragraph, Title, Text } = Typography;

/**
 * E-01/E-02 description region 3 — 추천 학습 카드.
 *
 * 답안 약점을 바탕으로 복습 콘텐츠나 유사 문제를 추천하는 영역. 답안별 맞춤
 * AI 추천 데이터는 아직 피드백 번들에 포함되지 않으므로(추천 없음), description
 * region 3 예외("다음 문제 없음은 직접 문제 목록 CTA로 대체")에 따라 약점 기반
 * 추천 화면과 문제 목록으로 연결하는 정직한 진입 카드로 제공한다. 없는 기능을
 * 있는 것처럼 보이지 않도록 카피로 한정한다.
 */
export function FeedbackRecommendationCard() {
  const router = useRouter();
  return (
    <Card>
      <Title level={5} style={{ marginTop: 0 }}>
        추천 학습
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        이번 답안에서 약했던 영역은 약점 분석에서 한눈에 볼 수 있어요. 비슷한
        유형을 더 풀면 추천이 점점 정확해집니다.
      </Paragraph>
      <Space wrap>
        <Button type="primary" onClick={() => router.push("/practice/weakness")}>
          약점 기반 추천 보기
        </Button>
        <Button onClick={() => router.push("/practice/problems")}>
          문제 목록 보기
        </Button>
      </Space>
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          답안별 맞춤 추천은 학습 결과가 쌓이면 더 정교해져요.
        </Text>
      </div>
    </Card>
  );
}
