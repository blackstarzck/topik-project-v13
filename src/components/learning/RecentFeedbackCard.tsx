"use client";

import { Card, Empty, List, Tag, Typography } from "antd";
import Link from "next/link";

const { Text } = Typography;

export type RecentFeedbackItem = {
  submissionId: string;
  questionNo: number | null;
  scoreTotal: number | null;
  generatedAt: string;
};

type Props = {
  items: RecentFeedbackItem[];
};

/**
 * Phase 7-D Task 11 (P1-7) — B-01 최근 피드백 카드.
 * IA spec: docs/IA/04-B-01-home-dashboard/description.md 추가 항목.
 * 최근 3건 표시 + 상세 페이지 링크.
 */
export function RecentFeedbackCard({ items }: Props) {
  return (
    <Card title="최근 피드백">
      {items.length === 0 ? (
        <Empty description="아직 받은 피드백이 없어요. 글쓰기를 제출해 보세요." />
      ) : (
        <List
          dataSource={items.slice(0, 3)}
          renderItem={(item) => (
            <List.Item
              key={item.submissionId}
              actions={[
                <Link
                  key="view"
                  href={`/writing/feedback/long/${item.submissionId}` as never}
                >
                  보기
                </Link>,
              ]}
            >
              <Tag>{item.questionNo != null ? `${item.questionNo}번` : "—"}</Tag>
              <span style={{ marginLeft: 8 }}>
                점수{" "}
                <strong>
                  {item.scoreTotal != null
                    ? Math.round(item.scoreTotal) + "점"
                    : "대기"}
                </strong>
              </span>
              <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                {new Date(item.generatedAt).toLocaleDateString("ko-KR")}
              </Text>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
