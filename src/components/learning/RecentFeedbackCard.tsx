"use client";

import { Card, Empty, Flex, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { writingFeedbackHref } from "@/lib/writing/routes";

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
        // antd 6.x deprecates the `List` component → compose with Flex (stable).
        // role=list/listitem preserves the ul/li semantics List provided.
        <Flex vertical role="list">
          {items.slice(0, 3).map((item, idx, arr) => (
            <Flex
              key={item.submissionId}
              role="listitem"
              justify="space-between"
              align="center"
              gap="middle"
              wrap
              style={{
                padding: "12px 0",
                borderBottom:
                  idx < arr.length - 1
                    ? "1px solid var(--app-color-border)"
                    : undefined,
              }}
            >
              <Flex align="center" gap="small" wrap>
                <Tag>
                  {item.questionNo != null
                    ? t("questionNo", { no: item.questionNo })
                    : "—"}
                </Tag>
                <span>
                  {t("scoreLabel")}{" "}
                  <strong>
                    {item.scoreTotal != null
                      ? t("scoreValue", { score: Math.round(item.scoreTotal) })
                      : t("scorePending")}
                  </strong>
                </span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {/* Pin tz so SSR/client render the same date string (no React #418). */}
                  {new Date(item.generatedAt).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </Text>
              </Flex>
              <Link
                href={
                  writingFeedbackHref({
                    questionNo: item.questionNo,
                    submissionId: item.submissionId,
                  }) as never
                }
              >
                {t("view")}
              </Link>
            </Flex>
          ))}
        </Flex>
      )}
    </Card>
  );
}
