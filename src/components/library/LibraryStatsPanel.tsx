"use client";

import { Empty, Space, Statistic, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AppCard } from "@/components/shared/AppCard";

const { Text } = Typography;

const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
] as const;

export type LibraryStats = {
  /** Total saved library items across all tabs. */
  savedCount: number;
  /** Average writing_feedback score over saved submissions, or null. */
  avgScore: number | null;
  /** Lowest average dimension key, or null when not enough data exists. */
  weakestDimension: string | null;
  /** Count of saved retry submissions. */
  reviewCount: number;
  /** Latest library_items.saved_at ISO string. */
  lastUpdated: string | null;
};

type Props = {
  stats: LibraryStats;
};

export function LibraryStatsPanel({ stats }: Props) {
  const t = useTranslations("library.stats");
  const tDim = useTranslations("library.stats.dimensions");
  const empty = stats.savedCount === 0;

  function formatUpdated(iso: string | null): string {
    if (!iso) return t("noUpdate");
    try {
      return t("lastUpdated", {
        date: new Date(iso).toLocaleDateString("ko-KR"),
      });
    } catch {
      return t("noUpdate");
    }
  }

  const dimLabel = (code: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(code)
      ? tDim(code as (typeof DIMENSION_KEYS)[number])
      : code;

  if (empty) {
    return (
      <Space
        data-testid="library-stats-panel"
        orientation="vertical"
        size="middle"
        style={{ width: "100%" }}
      >
        <Text strong>{t("title")}</Text>
        <AppCard data-testid="library-empty-stats" size="small">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("emptyDescription")}
          >
            <Link href="/practice/problems">{t("goToPractice")}</Link>
          </Empty>
        </AppCard>
      </Space>
    );
  }

  return (
    <Space
      data-testid="library-stats-panel"
      orientation="vertical"
      size="middle"
      style={{ width: "100%" }}
    >
      <Text strong>{t("title")}</Text>
      <AppCard data-testid="library-stat-card" size="small">
        <Statistic
          title={t("savedCount")}
          value={stats.savedCount}
          suffix={t("suffixCount")}
        />
        <Text type="secondary">{formatUpdated(stats.lastUpdated)}</Text>
      </AppCard>

      <AppCard data-testid="library-stat-card" size="small">
        <Statistic
          title={t("avgScore")}
          value={stats.avgScore != null ? stats.avgScore : "-"}
          suffix={stats.avgScore != null ? t("suffixPoint") : undefined}
        />
        <Space size="small" wrap>
          <Text type="secondary">{t("weakestLabel")}</Text>
          {stats.weakestDimension ? (
            <Tag color="volcano">{dimLabel(stats.weakestDimension)}</Tag>
          ) : (
            <Text type="secondary">{t("weakestNeedData")}</Text>
          )}
        </Space>
      </AppCard>

      <AppCard data-testid="library-stat-card" size="small">
        <Statistic
          title={t("reviewCount")}
          value={stats.reviewCount}
          suffix={t("suffixCount")}
        />
        <Link href="/practice/problems">{t("continueReview")}</Link>
      </AppCard>
    </Space>
  );
}
