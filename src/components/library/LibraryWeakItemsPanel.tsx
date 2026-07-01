"use client";

import { Empty, Progress, Typography } from "antd";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import type { LibraryWeakItem } from "@/lib/library/types";

const { Text, Title } = Typography;

type Props = {
  items: LibraryWeakItem[];
};

export function LibraryWeakItemsPanel({ items }: Props) {
  const t = useTranslations("library.dashboard");
  const tDim = useTranslations("library.stats.dimensions");

  return (
    <AppCard data-testid="library-weak-items-panel" className="h-full">
      <div className="flex h-full min-h-[220px] flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Title level={5} className="m-0">
            {t("weak.title")}
          </Title>
          <Text type="secondary" className="text-xs">
            {t("weak.caption")}
          </Text>
        </div>
        {items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("weak.empty")} />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-[72px_1fr_44px] gap-3">
                <Text className="truncate">
                  {tDim(item.dimension as Parameters<typeof tDim>[0])}
                </Text>
                <Progress
                  percent={item.normalizedScore}
                  showInfo={false}
                  size="small"
                  strokeColor="var(--app-color-primary)"
                  railColor="var(--app-color-bg-layout)"
                />
                <Text className="text-right">{t("weak.score", { score: item.normalizedScore })}</Text>
              </div>
            ))}
            <div className="grid grid-cols-[72px_1fr_44px] gap-3">
              <span />
              <div className="flex justify-between text-xs text-text-secondary">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
              <span />
            </div>
          </div>
        )}
      </div>
    </AppCard>
  );
}
