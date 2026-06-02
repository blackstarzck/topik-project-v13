"use client";

import { Button, Card, Col, Row, Skeleton, Statistic, Tag, Typography } from "antd";
import type { AdminProblemRow } from "@/lib/admin/types";

const { Text } = Typography;

/**
 * H-01 region 2 — KPI/필터 band.
 *
 * description.md: "전체 문제 수, 공개 상태, 검수 대기, 난이도 분포" / "KPI 4개 이하"
 * / 예외 "데이터 로드 실패 시 KPI 스켈레톤과 재시도 제공".
 *
 * KPIs are derived from the full loaded problem set (the list query loads all
 * admin-visible problems), so they stay consistent with the table without a
 * second round-trip.
 */

type Props = {
  rows: AdminProblemRow[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

function difficultyDistribution(rows: AdminProblemRow[]): string {
  const buckets = new Map<number, number>();
  let unset = 0;
  for (const r of rows) {
    if (r.difficulty == null) {
      unset += 1;
      continue;
    }
    buckets.set(r.difficulty, (buckets.get(r.difficulty) ?? 0) + 1);
  }
  const parts = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => `${level}★ ${count}`);
  if (unset > 0) parts.push(`미설정 ${unset}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function AdminProblemKpiBand({ rows, loading, error, onRetry }: Props) {
  if (error) {
    return (
      <Card size="small">
        <Skeleton active paragraph={{ rows: 1 }} />
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ marginRight: 12 }}>
            KPI를 불러오지 못했어요.
          </Text>
          <Button size="small" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      </Card>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <Row gutter={[16, 16]}>
        {[0, 1, 2, 3].map((i) => (
          <Col xs={12} md={6} key={i}>
            <Card size="small">
              <Skeleton active paragraph={{ rows: 1 }} title={false} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  const total = rows.length;
  const published = rows.filter((r) => r.publish_status === "published").length;
  const pendingReview = rows.filter(
    (r) => r.review_status === "pending",
  ).length;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic title="전체 문제" value={total} suffix="개" />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic title="공개" value={published} suffix="개" />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic
            title="검수 대기"
            value={pendingReview}
            suffix="개"
            valueStyle={pendingReview > 0 ? { color: "#d48806" } : undefined}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Text type="secondary" style={{ fontSize: 14 }}>
            난이도 분포
          </Text>
          <div style={{ marginTop: 4 }}>
            <Tag color="blue">{difficultyDistribution(rows)}</Tag>
          </div>
        </Card>
      </Col>
    </Row>
  );
}
