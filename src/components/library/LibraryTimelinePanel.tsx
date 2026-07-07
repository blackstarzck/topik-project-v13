"use client";

import { Empty, Typography } from "antd";
import type { CardProps } from "antd";
import { Download, Eye, FileText, PenLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type {
  LibraryDashboardTimelineEventType,
  LibraryTimelineItem,
} from "@/lib/library/types";

import { formatDashboardRelativeTime } from "./library-dashboard-format";

const { Text } = Typography;

const cardClassNames = {
  body: "flex-1",
} satisfies CardProps["classNames"];

type Props = {
  items: LibraryTimelineItem[];
};

export function LibraryTimelinePanel({ items }: Props) {
  const t = useTranslations("library.dashboard");
  const locale = useLocale();

  return (
    <AppCard
      data-testid="library-timeline-panel"
      title={t("timeline.title")}
      className="flex h-full flex-col"
      classNames={cardClassNames}
    >
      <div className="flex h-full min-h-[220px] flex-col gap-4">
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("timeline.empty")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => {
              const Icon = eventIcon(item.eventType);
              const eventTypeLabel = t(
                `timeline.event.${item.eventType}` as Parameters<typeof t>[0],
              );
              const eventLabel =
                item.questionNo != null
                  ? t("timeline.eventWithQuestion", {
                      questionNo: t("questionNo", {
                        questionNo: item.questionNo,
                      }),
                      event: eventTypeLabel,
                    })
                  : eventTypeLabel;
              return (
                <div
                  key={item.id}
                  data-testid={`library-timeline-row-${item.id}`}
                  className="flex min-w-0 items-center justify-between gap-3"
                >
                  <span
                    data-testid={`library-timeline-content-${item.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <span
                      data-testid="library-timeline-icon"
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-text-secondary"
                    >
                      <Icon aria-hidden size={16} />
                    </span>
                    <Text className="min-w-0 truncate text-sm">
                      {eventLabel}
                    </Text>
                  </span>
                  <Text
                    data-testid={`library-timeline-time-${item.id}`}
                    type="secondary"
                    className="ml-auto flex-shrink-0 whitespace-nowrap text-right text-sm"
                  >
                    {formatDashboardRelativeTime(item.occurredAt, locale)}
                  </Text>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppCard>
  );
}

function eventIcon(type: LibraryDashboardTimelineEventType) {
  switch (type) {
    case "feedback_viewed":
      return Eye;
    case "report_viewed":
      return FileText;
    case "export_downloaded":
      return Download;
    case "submission_submitted":
    default:
      return PenLine;
  }
}
