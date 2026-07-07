"use client";

import { useMemo, useState } from "react";
import { Button, Empty, Spin, Tag, Tooltip, Typography } from "antd";
import type { CardProps } from "antd";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import { ChevronRight, RefreshCcw } from "@/components/shared/AppIcons";
import { fetchWithGoogleAnalytics } from "@/lib/analytics/google-analytics";
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

type SyncedFeedbackStatus = LibraryDashboardFeedbackWaitingStatus | "complete";

type SyncResult =
  | {
      ok: true;
      status: SyncedFeedbackStatus;
    }
  | {
      ok: false;
      status: SyncedFeedbackStatus | null;
    };

type Props = {
  items: LibraryFeedbackWaitingItem[];
};

export function LibraryFeedbackWaitingPanel({ items }: Props) {
  const t = useTranslations("library.dashboard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removedItemIds, setRemovedItemIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [statusByItemId, setStatusByItemId] = useState<
    ReadonlyMap<string, LibraryDashboardFeedbackWaitingStatus>
  >(() => new Map());
  const [syncErrorIds, setSyncErrorIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const visibleItems = useMemo(
    () =>
      items.flatMap((item) =>
        removedItemIds.has(item.id)
          ? []
          : [{ ...item, status: statusByItemId.get(item.id) ?? item.status }],
      ),
    [items, removedItemIds, statusByItemId],
  );

  const syncableItems = useMemo(
    () => visibleItems.filter((item) => isSyncableWaitingStatus(item.status)),
    [visibleItems],
  );

  const refreshWaitingItems = async () => {
    if (isRefreshing || syncableItems.length === 0) return;

    setIsRefreshing(true);
    setSyncErrorIds((current) => {
      const next = new Set(current);
      for (const item of syncableItems) next.delete(item.id);
      return next;
    });

    const results = await Promise.all(
      syncableItems.map(async (item) => ({
        item,
        result: await syncFeedbackWaitingStatus(item.submissionId),
      })),
    );

    setRemovedItemIds((current) => {
      const next = new Set(current);
      for (const { item, result } of results) {
        if (result.ok && result.status === "complete") next.add(item.id);
      }
      return next;
    });
    setStatusByItemId((current) => {
      const next = new Map(current);
      for (const { item, result } of results) {
        if (result.status === "complete") {
          next.delete(item.id);
        } else if (result.status) {
          next.set(item.id, result.status);
        }
      }
      return next;
    });
    setSyncErrorIds(
      new Set(
        results
          .filter(({ result }) => !result.ok)
          .map(({ item }) => item.id),
      ),
    );
    setIsRefreshing(false);
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
            disabled={isRefreshing || syncableItems.length === 0}
            onClick={() => {
              void refreshWaitingItems();
            }}
          />
        </Tooltip>
      }
      className="library-feedback-waiting-panel flex h-full flex-col"
      classNames={cardClassNames}
    >
      <div className="flex h-full min-h-[220px] flex-col gap-4">
        {visibleItems.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("waiting.empty")}
          />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {visibleItems.map((item) => (
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

function isSyncableWaitingStatus(
  status: LibraryDashboardFeedbackWaitingStatus,
) {
  return status === "pending" || status === "analyzing";
}

async function syncFeedbackWaitingStatus(
  submissionId: string,
): Promise<SyncResult> {
  try {
    const response = await fetchWithGoogleAnalytics(
      `/api/writing/evaluation-status?submissionId=${encodeURIComponent(
        submissionId,
      )}`,
      { cache: "no-store" },
      { apiName: "writing_evaluation_status" },
    );
    const body = (await response.json().catch(() => null)) as {
      feedback_status?: unknown;
    } | null;
    const status = coerceSyncedFeedbackStatus(body?.feedback_status);
    if (!response.ok || !status) return { ok: false, status };
    return { ok: true, status };
  } catch {
    return { ok: false, status: null };
  }
}

function coerceSyncedFeedbackStatus(
  status: unknown,
): SyncedFeedbackStatus | null {
  if (
    status === "pending" ||
    status === "analyzing" ||
    status === "complete" ||
    status === "failed"
  ) {
    return status;
  }
  return null;
}
