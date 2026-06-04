"use client";

import { Card, Empty, Space, Statistic, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

const { Text } = Typography;

// dimension 코드 → library.stats.dimensions 카탈로그 키. 문구는 t()로 해석한다.
const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
] as const;

export type LibraryStats = {
  /** Total saved library items (all tabs). */
  savedCount: number;
  /** Average writing_feedback score over saved submissions (0-100), or null. */
  avgScore: number | null;
  /** Weakest dimension key (lowest avg), or null when not enough data. */
  weakestDimension: string | null;
  /** Count of retry submissions (parent_submission_id not null) among saved. */
  reviewCount: number;
  /** ISO of the most recent saved_at, drives the last-updated line. */
  lastUpdated: string | null;
};

type Props = {
  stats: LibraryStats;
};

/**
 * F-01 region 4 (우측 통계): 저장 수 / 평균 점수 / 취약 유형 / 복습 현황 +
 * last-updated. Constraint: 통계 카드 3개 이하 per group, 수치 라벨 1줄.
 * Exception (데이터 없음): show a 복습 시작 안내 instead of empty numbers.
 */
export function LibraryStatsPanel({ stats }: Props) {
  const t = useTranslations("library.stats");
  const tDim = useTranslations("library.stats.dimensions");
  const empty = stats.savedCount === 0;

  // last-updated 라인: ISO를 ko-KR 날짜로 포맷해 "최근 갱신 {date}"로 보여준다.
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

  // dimension 코드를 카탈로그 라벨로. 알 수 없는 코드는 코드 그대로 폴백.
  const dimLabel = (code: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(code)
      ? tDim(code as (typeof DIMENSION_KEYS)[number])
      : code;

  if (empty) {
    return (
      <Card title={t("title")}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("emptyDescription")}
        >
          <Link href="/practice/problems">{t("goToPractice")}</Link>
        </Empty>
      </Card>
    );
  }

  return (
    <Card
      title={t("title")}
      extra={
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatUpdated(stats.lastUpdated)}
        </Text>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space size="large" wrap>
          <Statistic
            title={t("savedCount")}
            value={stats.savedCount}
            suffix={t("suffixCount")}
          />
          <Statistic
            title={t("avgScore")}
            value={stats.avgScore != null ? stats.avgScore : "—"}
            suffix={stats.avgScore != null ? t("suffixPoint") : undefined}
          />
          <Statistic
            title={t("reviewCount")}
            value={stats.reviewCount}
            suffix={t("suffixCount")}
          />
        </Space>
        <div>
          <Text type="secondary">{t("weakestLabel")}</Text>
          {stats.weakestDimension ? (
            <Tag color="volcano">{dimLabel(stats.weakestDimension)}</Tag>
          ) : (
            <Text type="secondary">{t("weakestNeedData")}</Text>
          )}
        </div>
        <Link href="/practice/problems">{t("continueReview")}</Link>
      </Space>
    </Card>
  );
}
