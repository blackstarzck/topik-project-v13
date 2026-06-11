"use client";

import { Alert, Divider, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AppCard } from "@/components/shared/AppCard";

const { Text, Paragraph } = Typography;

type Props = {
  joinedAt: string;
  appRole: string;
  planLabel: string;
  /** X-05 region 4 — profile visibility badge. Defaults to private. */
  visibility?: "public" | "private";
  /** X-05 region 4 예외 — surface a warning when policy not agreed. */
  policyAgreed?: boolean;
};

// 라벨 문구는 profile.status.role.* 카탈로그 키로 해석한다. 알 수 없는 역할 코드는
// 카탈로그에 없으므로 raw 코드를 그대로 노출한다(향후 역할 호환).
const KNOWN_ROLE_KEYS = [
  "learner",
  "content_admin",
  "org_admin",
  "platform_admin",
] as const;

/**
 * Phase 7-E Task 10 (P1-6) — 상태/도움 카드.
 * X-05 region 4: 공개 범위 배지 + 데이터 활용/정책 동의 안내 + 학습 목표 반영.
 */
export function StatusHelpCard({
  joinedAt,
  appRole,
  planLabel,
  visibility = "private",
  policyAgreed = true,
}: Props) {
  const t = useTranslations("profile.status");
  // 동적 키라 strict 타이핑이 bare string 을 거부하므로 캐스트한다. 미지원 역할은
  // 카탈로그 키가 없으므로 raw appRole 로 대체.
  const roleLabel = (KNOWN_ROLE_KEYS as readonly string[]).includes(appRole)
    ? t(`role.${appRole}` as Parameters<typeof t>[0])
    : appRole;
  return (
    <AppCard title={t("cardTitle")}>
      {/* X-05 region 4 예외: 정책 미동의 경고 */}
      {!policyAgreed ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={t("policyWarningTitle")}
          description={t("policyWarningDescription")}
        />
      ) : null}
      <Paragraph>
        <Text type="secondary">{t("visibilityLabel")}</Text>
        <Tag color={visibility === "public" ? "green" : "default"}>
          {visibility === "public" ? t("visibilityPublic") : t("visibilityPrivate")}
        </Tag>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">{t("roleLabelPrefix")}</Text>
        <Tag>{roleLabel}</Tag>
        <Text type="secondary" style={{ marginLeft: 12 }}>{t("planLabelPrefix")}</Text>
        <Tag color="gold">{planLabel}</Tag>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">{t("joinedLabelPrefix")}</Text>
        <Text strong>{new Date(joinedAt).toLocaleDateString("ko-KR")}</Text>
      </Paragraph>
      <Paragraph style={{ marginBottom: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t("goalNote")}
        </Text>
      </Paragraph>
      <Divider />
      <Paragraph>
        <Link href="/settings/notifications">{t("notificationsLink")}</Link>
        <Text type="secondary"> · </Text>
        <Link href="/settings/language">{t("languageLink")}</Link>
      </Paragraph>
      <Paragraph style={{ marginBottom: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t("withdrawalNote")}
        </Text>
      </Paragraph>
    </AppCard>
  );
}
