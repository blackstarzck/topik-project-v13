"use client";

import { useEffect, useState } from "react";
import { Alert, App, Button, Form, Input, Space, Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { AppCard } from "@/components/shared/AppCard";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title, Text } = Typography;

type Fields = { password: string; passwordConfirm: string };

// Supabase recovery 링크 기본 유효시간 ≈ 1시간. 정확한 발급 시각은 클라이언트에
// 없으므로(이메일에서 진입), 페이지 진입 시각 + 1h 를 "대략" 만료 시각으로 안내한다.
// 가짜 정밀도를 만들지 않도록 "약" 으로 명시 (description §4: 절대/상대 시간 병기).
const LINK_TTL_MINUTES = 60;

function formatAbsolute(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function PasswordResetConfirmForm() {
  const t = useTranslations("auth.passwordResetConfirm");
  // Cross-namespace: server change-failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const locale = useLocale();
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // description §6 예외: 저장 실패/만료 시 재시도 + 링크 재발송 CTA 제공.
  const [saveFailed, setSaveFailed] = useState(false);
  // §3: 새 비밀번호 강도/규칙 실시간 검증을 위해 입력값 watch.
  const [passwordValue, setPasswordValue] = useState("");
  // §4: 서버와 첫 클라이언트 렌더는 둘 다 null 로 맞추고, hydration 이후에만
  // 클라이언트 시간을 표시한다. setTimeout callback 에서 갱신해 synchronous
  // setState-in-effect 와 render-time Date.now 둘 다 피한다.
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExpiresAt(new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(values: Fields) {
    setSubmitting(true);
    setSaveFailed(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      // raw provider error_description은 노출하지 않고 매핑된 메시지만 사용.
      const reason = mapSupabaseErrorCode(error.code);
      message.error(
        t("changeFailed", {
          message: te(`${reason}.message` as Parameters<typeof te>[0]),
        }),
      );
      setSaveFailed(true);
      return;
    }
    message.success(t("changeSuccess"));
    router.push("/login");
  }

  return (
    // §1 재설정 카드 — 절차 전체를 담는 surface (폭은 PageContainer narrow 가 제어).
    <AppCard data-testid="password-reset-confirm-card">
      <Form
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        data-testid="password-reset-confirm-form"
      >
        {/* §5 마스코트 — 보안 절차 긴장감 완화, 입력 영역을 가리지 않게 상단 배치 */}
        <AuthMascot
          alt={t("mascotAlt")}
          emoji="🔐"
          size={48}
        />
        {/* §2 흐름 안내 — Stepper 미사용, 헤더 카피가 곧 위치 안내 */}
        <Title level={3} style={{ textAlign: "center", marginTop: 12 }}>
          {t("title")}
        </Title>
        <Paragraph type="secondary" style={{ textAlign: "center" }}>
          {t("subtitle")}
        </Paragraph>

        {/* §4 안내 카피 — 보안 조건 + 만료 시간(절대/상대 병기) */}
        <Paragraph
          style={{ marginBottom: 16 }}
          data-testid="password-reset-confirm-guide"
        >
          <Text type="secondary">
            {t("guideBase")}
            {expiresAt ? (
              <>
                {" "}
                {t("guideExpiry", {
                  minutes: LINK_TTL_MINUTES,
                  time: formatAbsolute(expiresAt, locale),
                })}
              </>
            ) : null}
          </Text>
        </Paragraph>

        {saveFailed && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            data-testid="password-reset-confirm-error"
            title={t("saveFailedTitle")}
            description={
              <span>
                {t("saveFailedDescriptionPrefix")}
                <Link
                  href="/password-reset"
                  data-testid="password-reset-confirm-request-link"
                >
                  {t("saveFailedDescriptionLink")}
                </Link>
                {t("saveFailedDescriptionSuffix")}
              </span>
            }
          />
        )}

        <Form.Item
          label={t("newPasswordLabel")}
          name="password"
          htmlFor="password-reset-confirm-password"
          rules={[
            { required: true, message: t("passwordRequired") },
            { min: 8, message: t("passwordMin") },
            { max: 64, message: t("passwordMax") },
          ]}
        >
          <Input.Password
            id="password-reset-confirm-password"
            autoComplete="new-password"
            onChange={(event) => setPasswordValue(event.target.value)}
          />
        </Form.Item>

        {/* §3: 비밀번호 규칙 실시간 검증 (강도 + 체크리스트) */}
        <PasswordStrengthMeter password={passwordValue} />

        <Form.Item
          label={t("passwordConfirmLabel")}
          name="passwordConfirm"
          htmlFor="password-reset-confirm-password-confirm"
          dependencies={["password"]}
          rules={[
            { required: true, message: t("passwordConfirmRequired") },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("passwordMismatch")));
              },
            }),
          ]}
        >
          <Input.Password
            id="password-reset-confirm-password-confirm"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space orientation="vertical" size="small" style={{ width: "100%" }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              data-testid="password-reset-confirm-submit"
            >
              {t("submit")}
            </Button>
            {/* §6: 로그인 화면 복귀 escape */}
            <Link href="/login">
              <Button
                type="link"
                block
                data-testid="password-reset-confirm-login"
              >
                {t("backToLoginButton")}
              </Button>
            </Link>
          </Space>
        </Form.Item>
      </Form>
    </AppCard>
  );
}
