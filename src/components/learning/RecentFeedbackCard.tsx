"use client";

import { Card, Empty, List, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
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
 * IA spec: docs/Wireframe/04-B-01-home-dashboard/description.md 추가 항목.
 * 최근 3건 표시 + 상세 페이지 링크.
 */
export function RecentFeedbackCard({ items }: Props) {
  const t = useTranslations("dashboard.recentFeedback");
  return (
    <Card title={t("title")}>
      {items.length === 0 ? (
        <Empty description={t("empty")} />
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
                  {t("view")}
                </Link>,
              ]}
            >
              <Tag>
                {item.questionNo != null
                  ? t("questionNo", { no: item.questionNo })
                  : "—"}
              </Tag>
              <span style={{ marginLeft: 8 }}>
                {t("scoreLabel")}{" "}
                <strong>
                  {item.scoreTotal != null
                    ? t("scoreValue", { score: Math.round(item.scoreTotal) })
                    : t("scorePending")}
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
