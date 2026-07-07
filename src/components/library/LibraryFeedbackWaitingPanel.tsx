"use client";

import { useTransition } from "react";
import { Button, Empty, Spin, Tag, Tooltip, Typography } from "antd";
import type { CardProps } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AppCard } from "@/components/shared/AppCard";
import { ChevronRight, RefreshCcw } from "@/components/shared/AppIcons";
import type {
  LibraryDashboardFeedbackWaitingStatus,
  LibraryFeedbackWaitingItem,
} from "@/lib/library/types";
import { writingQuestionNeonClass } from "@/lib/writing/question-number-neon";

import { formatDashboardShortDateTime } from "./library-dashboard-format";

const { Text } = Typography;

const cardClassNames = {
  body: "flex-1",
} satisfies CardProps["classNames"];

type Props = {
  items: LibraryFeedbackWaitingItem[];
};

export function LibraryFeedbackWaitingPanel({ items }: Props) {
  const t = useTranslations("library.dashboard");
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  const refreshWaitingItems = () => {
    startRefresh(() => {
      router.refresh();
    });
  };

  return (
    <AppCard
      data-testid="library-feedback-waiting-panel"
      title={t("waiting.title")}
      extra={
        <Tooltip title={t("waiting.refreshTooltip")}>
          <Button
            type="text"
            aria-label={t("waiting.refreshAria")}
            data-testid="library-feedback-waiting-refresh"
            icon={<RefreshCcw aria-hidden size={16} />}
            loading={isRefreshing}
            disabled={isRefreshing}
            onClick={refreshWaitingItems}
          />
        </Tooltip>
      }
      className="library-feedback-waiting-panel flex h-full flex-col"
      classNames={cardClassNames}
    >
      <div className="flex h-full min-h-[220px] flex-col gap-4">
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("waiting.empty")}
          />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                data-testid="library-feedback-waiting-row"
                className="app-card-compact grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"
              >
                <span
                  data-testid="library-feedback-waiting-question"
                  className="flex min-w-0 items-start"
                >
                  {item.questionNo ? (
                    <span
                      aria-label={t("questionNo", {
                        questionNo: item.questionNo,
                      })}
                      className={[
                        "writing-question-number library-review-candidate-question-number font-['Space_Grotesk'] leading-none",
                        writingQuestionNeonClass(
                          "writing-question-number",
                          item.questionNo,
                        ),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {item.questionNo}
                    </span>
                  ) : (
                    <Tag className="m-0 text-sm">{t("questionUnknown")}</Tag>
                  )}
                </span>
                <span
                  data-testid="library-feedback-waiting-content"
                  className="min-w-0 flex-1"
                >
                  <Text strong className="block truncate">
                    {item.title}
                  </Text>
                  <Text
                    type="secondary"
                    data-testid="library-feedback-waiting-meta"
                    className="block !text-[14px] !leading-[22px]"
                  >
                    {formatDashboardShortDateTime(item.submittedAt)}
                    {" \u00b7 "}
                    {t("charCount", { count: item.charCount })}
                  </Text>
                </span>
                <span
                  data-testid="library-feedback-waiting-status-actions"
                  className="flex items-start justify-end gap-2"
                >
                  {item.status === "analyzing" ? (
                    <span
                      data-testid="library-feedback-waiting-spinner"
                      role="status"
                      aria-label={t("waiting.status.analyzing")}
                      className="inline-flex h-6 items-center justify-center"
                    >
                      <Spin size="small" />
                    </span>
                  ) : (
                    <Tag
                      color={statusColor(item.status)}
                      className="m-0 flex-shrink-0"
                    >
                      {t(
                        `waiting.status.${item.status}` as Parameters<
                          typeof t
                        >[0],
                      )}
                    </Tag>
                  )}
                  {item.status === "failed" && item.retryHref ? (
                    <Button
                      href={item.retryHref}
                      aria-label={t("waiting.retryAria", {
                        title: item.title,
                      })}
                      icon={<ChevronRight aria-hidden size={14} />}
                    />
                  ) : item.status === "failed" ? (
                    <Button disabled>{t("waiting.retryUnavailable")}</Button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppCard>
  );
}

function statusColor(status: LibraryDashboardFeedbackWaitingStatus) {
  if (status === "failed") return "error";
  if (status === "analyzing") return "processing";
  return "warning";
}
