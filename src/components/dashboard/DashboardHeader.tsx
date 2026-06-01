"use client";

import { Button, Space, Typography } from "antd";
import Link from "next/link";

const { Title, Paragraph } = Typography;

/**
 * B-01 home dashboard header. description.md 목적: "현재 학습 상태와 다음 행동을
 * 요약해 홈 진입점을 만든다." Surfaces the single primary next-action CTA
 * ("학습 시작") at the top of the populated dashboard so the home entry point
 * has one clear forward action that points at the practice/recommendation flow.
 */
export function DashboardHeader() {
  return (
    <Space
      align="start"
      style={{ width: "100%", justifyContent: "space-between" }}
      wrap
    >
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          홈 대시보드
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          오늘의 학습 상태와 다음 할 일을 한눈에 확인하세요.
        </Paragraph>
      </div>
      <Link href="/practice/recommendations">
        <Button type="primary" size="large">
          학습 시작
        </Button>
      </Link>
    </Space>
  );
}
