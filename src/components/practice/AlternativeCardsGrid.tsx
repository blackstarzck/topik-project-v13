"use client";

import { Card, Col, Empty, Row, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";

const { Text, Title } = Typography;

type AlternativeProblem = {
  id: string;
  title: string;
  questionNo: number | null;
  domain: string;
  reason?: string | null;
};

type Props = {
  alternatives: AlternativeProblem[];
};

/**
 * Phase 7-D Task 6 (P1-2) — R-02 alternatives section.
 * 3개 대안 카드 grid. primary 다음에 사용자가 고를 수 있는 옵션.
 */
export function AlternativeCardsGrid({ alternatives }: Props) {
  const router = useRouter();

  if (alternatives.length === 0) {
    return (
      <div>
        <Title level={5}>다른 추천</Title>
        <Empty description="추가로 추천할 문제가 없어요." />
      </div>
    );
  }

  return (
    <div>
      <Title level={5}>다른 추천</Title>
      <Row gutter={[12, 12]}>
        {alternatives.slice(0, 3).map((a) => (
          <Col key={a.id} xs={24} md={8}>
            <Card
              hoverable
              onClick={() =>
                router.push(`/practice/problems/${a.id}` as never)
              }
              title={
                <Tag color="default">
                  {a.questionNo != null ? `${a.questionNo}번` : a.domain}
                </Tag>
              }
            >
              <Text strong>
                {a.title.length > 32 ? `${a.title.slice(0, 32)}…` : a.title}
              </Text>
              {a.reason ? (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {a.reason}
                  </Text>
                </div>
              ) : null}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
