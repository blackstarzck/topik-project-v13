"use client";

import { Alert } from "antd";
import { useTranslations } from "next-intl";

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

  // 라벨 카탈로그 키는 본래 접두사 형태("공개 범위 " 등)라 trim해 행 라벨로 쓴다.
  const rows = [
    {
      key: "visibility",
      label: t("visibilityLabel").trim(),
      value:
        visibility === "public"
          ? t("visibilityPublic")
          : t("visibilityPrivate"),
    },
    { key: "role", label: t("roleLabelPrefix").trim(), value: roleLabel },
    { key: "plan", label: t("planLabelPrefix").trim(), value: planLabel },
    {
      key: "joined",
      label: t("joinedLabelPrefix").trim(),
      value: new Date(joinedAt).toLocaleDateString("ko-KR"),
    },
  ];

  return (
    <section aria-label={t("cardTitle")}>
      {/* X-05 region 4 예외: 정책 미동의 경고 */}
      {!policyAgreed ? (
        <Alert
          type="warning"
          showIcon
          className="account-login-error"
          title={t("policyWarningTitle")}
          description={t("policyWarningDescription")}
        />
      ) : null}
      <div>
        {rows.map((row) => (
          <div key={row.key} className="account-status-row">
            <span className="account-status-row__label">{row.label}</span>
            <span className="account-status-row__value">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
