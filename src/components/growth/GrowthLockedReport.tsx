"use client";

import { Button, Result, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("growth.locked");
  // planLabel 이 없으면 "무료" 로 표시. Tag 는 rich 청크로 본문 안에 끼워 넣는다.
  const planText = planLabel ?? t("freePlan");
  return (
    <div data-testid="growth-locked-report">
      <Result
        icon={
          <span style={{ fontSize: 40 }} aria-hidden>
            🔒
          </span>
        }
        title={t("title")}
        subTitle={
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {t.rich("body", {
                plan: () => <Tag>{planText}</Tag>,
              })}
            </Paragraph>
          </Space>
        }
        extra={
          <Space wrap>
            <Link href="/paywall">
              <Button data-testid="growth-upgrade-cta" type="primary">
                {t("upgradeCta")}
              </Button>
            </Link>
            <Link href="/subscription">
              <Button data-testid="growth-manage-cta">{t("manageCta")}</Button>
            </Link>
          </Space>
        }
      />
    </div>
  );
}
