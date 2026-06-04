"use client";

// "use client" is required: this segment skeleton renders the antd compound
// subcomponent <Skeleton.Button>. In a React Server Component an antd compound
// member resolves to `undefined` (RSC client-reference proxy) → runtime
// "Element type is invalid". Enforced by the M2 guard in scripts/ai-workflow-check.mjs.
import { Col, Row, Skeleton, Space } from "antd";

import { AppCard } from "@/components/shared/AppCard";

// Skeleton placeholder dimensions (px) — presentational hints sized to mirror
// the real content footprint (CLS reservation), not design tokens.
const SKELETON_TITLE_WIDTH = 200;
const SKELETON_BUTTON_WIDTH = 120;

/**
 * B-01 dashboard segment loading skeleton (PLAN §G #10).
 *
 * Layout-matched skeleton that mirrors DashboardBody (header + 4 KPI tiles +
 * recommendations/side row + recent feedback) on shared AppCard surfaces. It
 * reserves the same grid footprint so swapping to real content keeps CLS low.
 * Purely structural — no copy. Shown for loads over ~300ms via Suspense.
 */
export default function DashboardLoading() {
  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      {/* header: title + primary CTA */}
      <div className="app-page-header">
        <div className="app-page-header__titles" style={{ flex: 1 }}>
          <Skeleton
            active
            title={{ width: SKELETON_TITLE_WIDTH }}
            paragraph={{ rows: 1, width: "60%" }}
          />
        </div>
        <Skeleton.Button active size="large" style={{ width: SKELETON_BUTTON_WIDTH }} />
      </div>

      {/* area 2 — 4 KPI tiles */}
      <Row gutter={[16, 16]}>
        {[0, 1, 2, 3].map((i) => (
          <Col key={i} xs={12} md={6}>
            <AppCard size="small" style={{ height: "100%" }}>
              <Skeleton
                active
                title={{ width: "70%" }}
                paragraph={{ rows: 1, width: "40%" }}
              />
            </AppCard>
          </Col>
        ))}
      </Row>

      {/* area 3 recommendations + area 4 schedule/alerts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <AppCard>
            <Skeleton active paragraph={{ rows: 4 }} />
          </AppCard>
        </Col>
        <Col xs={24} md={8}>
          <AppCard>
            <Skeleton active paragraph={{ rows: 3 }} />
          </AppCard>
        </Col>
      </Row>

      {/* recent feedback */}
      <AppCard>
        <Skeleton active paragraph={{ rows: 3 }} />
      </AppCard>
    </Space>
  );
}
