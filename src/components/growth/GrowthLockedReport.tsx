"use client";

import { Button, Result, Space, Tag, Typography } from "antd";
import Link from "next/link";

const { Paragraph } = Typography;

/**
 * X-02 area 1 예외 — 권한 없는 리포트는 잠금 안내와 업그레이드 CTA 표시.
 *
 * 무료 플랜(plan_label !== premium/pro/team) 사용자에게 상세 성장 리포트가
 * 잠겨 있음을 정직하게 안내하고 결제(X-03 paywall) 동선을 제공한다. 잠금
 * 사유를 텍스트로 명시(색상만으로 의미 전달 금지).
 */
export function GrowthLockedReport({ planLabel }: { planLabel: string | null }) {
  return (
    <Result
      icon={<span style={{ fontSize: 40 }} aria-hidden>🔒</span>}
      title="상세 성장 리포트는 유료 플랜 전용이에요"
      subTitle={
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            현재 플랜
            {": "}
            <Tag>{planLabel ?? "무료"}</Tag>
            에서는 기본 지표만 볼 수 있어요. 업그레이드하면 추세 차트와 약점
            매트릭스, 맞춤 인사이트가 모두 열립니다.
          </Paragraph>
        </Space>
      }
      extra={
        <Space wrap>
          <Link href="/paywall">
            <Button type="primary">플랜 업그레이드</Button>
          </Link>
          <Link href="/subscription">
            <Button>구독 관리</Button>
          </Link>
        </Space>
      }
    />
  );
}
