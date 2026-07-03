"use client";

import { Button, Empty, Tag, Typography } from "antd";
import type { CardProps } from "antd";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type {
  LibraryDashboardFeedbackWaitingStatus,
  LibraryFeedbackWaitingItem,
} from "@/lib/library/types";

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

  return (
    <AppCard
      data-testid="library-feedback-waiting-panel"
      title={t("waiting.title")}
      className="flex h-full flex-col"
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
                className="app-card-compact flex items-center gap-3"
              >
                <Tag className="m-0 flex-shrink-0">
                  {item.questionNo
                    ? t("questionNo", { questionNo: item.questionNo })
                    : t("questionUnknown")}
                </Tag>
                <span className="min-w-0 flex-1">
                  <Text strong className="block truncate">
                    {item.title}
                  </Text>
                  <Text type="secondary" className="block text-xs">
                    {t("waiting.submittedAt", {
                      date: formatDashboardShortDateTime(item.submittedAt),
                      count: item.charCount,
                    })}
                  </Text>
                </span>
                <Tag
                  color={statusColor(item.status)}
                  className="m-0 flex-shrink-0"
                >
                  {t(
                    `waiting.status.${item.status}` as Parameters<typeof t>[0],
                  )}
                </Tag>
                {item.status === "failed" && item.retryHref ? (
                  <Button
                    href={item.retryHref}
                    aria-label={t("waiting.retryAria", { title: item.title })}
                    icon={<ChevronRight aria-hidden size={14} />}
                  />
                ) : item.status === "failed" ? (
                  <Button disabled>{t("waiting.retryUnavailable")}</Button>
                ) : (
                  <Button disabled>{t("waiting.disabled")}</Button>
                )}
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
