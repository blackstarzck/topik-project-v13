"use client";

import { Empty, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AppCard } from "@/components/shared/AppCard";
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
  className?: string;
};

/**
 * Phase 7-D Task 11 (P1-7) — B-01 최근 피드백 카드.
 * IA spec: docs/Wireframe/04-B-01-home-dashboard/description.md 추가 항목.
 * 최근 3건 표시 + 상세 페이지 링크.
 */
export function RecentFeedbackCard({ items, className }: Props) {
  const t = useTranslations("dashboard.recentFeedback");
  return (
    <AppCard
      title={t("title")}
      className={["flex flex-col", className].filter(Boolean).join(" ")}
      classNames={{ body: "flex-1" }}
    >
      {items.length === 0 ? (
        <Empty description={t("empty")} />
      ) : (
        // antd 6.x deprecates the `List` component → compose with semantic divs.
        // role=list/listitem preserves the ul/li semantics List provided.
        <div className="grid" role="list">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.submissionId}
              role="listitem"
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="inline-flex min-h-7 items-center rounded-sm bg-surface px-3 text-sm font-semibold text-text-secondary">
                  {item.questionNo != null
                    ? t("questionNo", { no: item.questionNo })
                    : "—"}
                </span>
                <span className="text-sm text-text">
                  {t("scoreLabel")}{" "}
                  <strong>
                    {item.scoreTotal != null
                      ? t("scoreValue", { score: Math.round(item.scoreTotal) })
                      : t("scorePending")}
                  </strong>
                </span>
                <Text type="secondary" className="!text-sm">
                  {/* Pin tz so SSR/client render the same date string. */}
                  {new Date(item.generatedAt).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </Text>
              </div>
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
            </div>
          ))}
        </div>
      )}
    </AppCard>
  );
}
