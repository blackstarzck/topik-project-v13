"use client";

import { Button, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

const { Title, Paragraph } = Typography;

/**
 * B-01 home dashboard header. description.md 목적: "현재 학습 상태와 다음 행동을
 * 요약해 홈 진입점을 만든다." Surfaces the single primary next-action CTA
 * ("학습 시작") at the top of the populated dashboard so the home entry point
 * has one clear forward action that points at the practice/recommendation flow.
 */
export function DashboardHeader() {
  const t = useTranslations("dashboard.header");
  return (
    <Space
      align="start"
      style={{ width: "100%", justifyContent: "space-between" }}
      wrap
    >
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {t("title")}
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t("subtitle")}
        </Paragraph>
      </div>
      <Link href="/practice/recommendations">
        <Button type="primary" size="large">
          {t("startCta")}
        </Button>
      </Link>
    </Space>
  );
}
