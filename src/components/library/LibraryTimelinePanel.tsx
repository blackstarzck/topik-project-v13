"use client";

import { Button, Empty, Tag, Typography } from "antd";
import { Download, Eye, FileText, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type {
  LibraryDashboardTimelineEventType,
  LibraryTimelineItem,
} from "@/lib/library/types";
import { APP_ROUTES } from "@/lib/routes";

import { formatDashboardDateTime } from "./library-dashboard-format";

const { Text, Title } = Typography;

type Props = {
  items: LibraryTimelineItem[];
};

export function LibraryTimelinePanel({ items }: Props) {
  const t = useTranslations("library.dashboard");

  return (
    <AppCard data-testid="library-timeline-panel" className="h-full">
      <div className="flex h-full min-h-[220px] flex-col gap-4">
        <Title level={5} className="m-0">
          {t("timeline.title")}
        </Title>
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("timeline.empty")}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const Icon = eventIcon(item.eventType);
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="library-timeline-icon flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
                      <Icon aria-hidden size={15} />
                    </span>
                    <Text type="secondary" className="w-[116px] flex-shrink-0 text-sm">
                      {formatDashboardDateTime(item.occurredAt)}
                    </Text>
                    <Text className="min-w-0 flex-1 truncate">
                      {t(
                        `timeline.event.${item.eventType}` as Parameters<
                          typeof t
                        >[0],
                      )}
                    </Text>
                    {item.questionNo ? (
                      <Tag className="m-0 flex-shrink-0">
                        {t("questionNo", { questionNo: item.questionNo })}
                      </Tag>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Button className="mt-auto" href={APP_ROUTES.growth}>
              {t("timeline.viewAll")}
            </Button>
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
