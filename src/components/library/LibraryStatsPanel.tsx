"use client";

import { Card, Empty, Space, Statistic, Tag, Typography } from "antd";
import Link from "next/link";

const { Text } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합도",
};

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

function formatUpdated(iso: string | null): string {
  if (!iso) return "갱신 기록 없음";
  try {
    return `최근 갱신 ${new Date(iso).toLocaleDateString("ko-KR")}`;
  } catch {
    return "갱신 기록 없음";
  }
}

/**
 * F-01 region 4 (우측 통계): 저장 수 / 평균 점수 / 취약 유형 / 복습 현황 +
 * last-updated. Constraint: 통계 카드 3개 이하 per group, 수치 라벨 1줄.
 * Exception (데이터 없음): show a 복습 시작 안내 instead of empty numbers.
 */
export function LibraryStatsPanel({ stats }: Props) {
  const empty = stats.savedCount === 0;

  if (empty) {
    return (
      <Card title="내 서재 통계">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="아직 저장한 자료가 없어요."
        >
          <Link href="/practice">문제 풀러 가기</Link>
        </Empty>
      </Card>
    );
  }

  return (
    <Card
      title="내 서재 통계"
      extra={
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatUpdated(stats.lastUpdated)}
        </Text>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space size="large" wrap>
          <Statistic title="저장 수" value={stats.savedCount} suffix="건" />
          <Statistic
            title="평균 점수"
            value={stats.avgScore != null ? stats.avgScore : "—"}
            suffix={stats.avgScore != null ? "점" : undefined}
          />
          <Statistic title="복습 현황" value={stats.reviewCount} suffix="건" />
        </Space>
        <div>
          <Text type="secondary">취약 유형 </Text>
          {stats.weakestDimension ? (
            <Tag color="volcano">
              {DIMENSION_LABELS[stats.weakestDimension] ??
                stats.weakestDimension}
            </Tag>
          ) : (
            <Text type="secondary">분석을 위한 데이터가 더 필요해요</Text>
          )}
        </div>
        <Link href="/practice">복습 이어가기</Link>
      </Space>
    </Card>
  );
}
