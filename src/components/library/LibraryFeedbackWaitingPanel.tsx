"use client";

import { Button, Empty, Spin, Tag, Tooltip, Typography } from "antd";
import type { CardProps } from "antd";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import { ChevronRight, RefreshCcw } from "@/components/shared/AppIcons";
import type {
  LibraryFeedbackWaitingSyncedStatus,
  LibraryFeedbackWaitingVisibleItem,
} from "@/lib/library/types";
import { writingFeedbackHref } from "@/lib/writing/routes";

import { formatDashboardShortDateTime } from "./library-dashboard-format";
import { LibraryReviewQuestionNumber } from "./LibraryReviewQuestionNumber";
import typographyStyles from "./LibraryTypography.module.css";

const { Text } = Typography;

const cardClassNames = {
  body: "flex-1",
} satisfies CardProps["classNames"];

type Props = {
  items: LibraryFeedbackWaitingVisibleItem[];
  canRefresh: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  syncErrorIds: ReadonlySet<string>;
};

export function LibraryFeedbackWaitingPanel({
  canRefresh,
  isRefreshing,
  items,
  onRefresh,
  syncErrorIds,
}: Props) {
  const t = useTranslations("library.dashboard");

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
            disabled={isRefreshing || !canRefresh}
            onClick={() => {
              onRefresh();
            }}
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
                  <LibraryReviewQuestionNumber questionNo={item.questionNo} />
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
                    className={`block ${typographyStyles.metadata}`}
                  >
                    {formatDashboardShortDateTime(item.submittedAt)}
                    {" \u00b7 "}
                    {t("charCount", { count: item.charCount })}
                  </Text>
                </span>
                <span
                  data-testid="library-feedback-waiting-status-actions"
                  className="flex flex-wrap items-start justify-end gap-2"
                >
                  {syncErrorIds.has(item.id) ? (
                    <Tag
                      color="warning"
                      data-testid="library-feedback-waiting-sync-error"
                      className="m-0 flex-shrink-0"
                    >
                      {t("waiting.statusCheckFailed")}
                    </Tag>
                  ) : item.status === "analyzing" ? (
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
                  ) : item.status === "complete" ? (
                    <Button
                      href={writingFeedbackHref({
                        questionNo: item.questionNo,
                        submissionId: item.submissionId,
                      })}
                      icon={<ChevronRight aria-hidden size={14} />}
                      iconPlacement="end"
                    >
                      {t("actions.viewFeedback")}
                    </Button>
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

function statusColor(status: LibraryFeedbackWaitingSyncedStatus) {
  if (status === "failed") return "error";
  if (status === "analyzing") return "processing";
  if (status === "complete") return "success";
  return "warning";
}
