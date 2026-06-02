"use client";

import { Button, Card, Col, Row, Skeleton, Statistic } from "antd";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchAdminUserStats, type AdminUserStats } from "./admin-rpc";

/**
 * X-10 region 2 — 사용자 KPI band.
 *
 * description.md: "전체/활성/차단 사용자와 제출 수" / "KPI 4개".
 * 예외: "데이터 실패는 빈 상태와 재시도 제공" → skeleton + 다시 시도.
 */
export function AdminUserKpiBand() {
  const query = useQuery<AdminUserStats, Error>({
    queryKey: ["admin-user-stats"],
    queryFn: () => fetchAdminUserStats(createSupabaseBrowserClient()),
  });

  if (query.error) {
    return (
      <Card size="small">
        <Skeleton active paragraph={{ rows: 1 }} />
        <div style={{ marginTop: 12 }}>
          <span style={{ marginRight: 12, color: "rgba(0,0,0,0.45)" }}>
            지표를 불러오지 못했어요.
          </span>
          <Button size="small" onClick={() => query.refetch()}>
            다시 시도
          </Button>
        </div>
      </Card>
    );
  }

  if (query.isLoading) {
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

  const s = query.data!;
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic title="전체 사용자" value={s.total_users} suffix="명" />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic
            title="활성"
            value={s.active_users}
            suffix="명"
            valueStyle={{ color: "#52c41a" }}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic
            title="차단"
            value={s.blocked_users}
            suffix="명"
            valueStyle={s.blocked_users > 0 ? { color: "#cf1322" } : undefined}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" style={{ height: "100%" }}>
          <Statistic title="총 제출" value={s.total_submissions} suffix="건" />
        </Card>
      </Col>
    </Row>
  );
}
