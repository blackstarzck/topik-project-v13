"use client";

import { useState } from "react";
import { Alert, App, Button, Card, Form, Input, Space, Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
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
  // §4: 만료 시간 절대/상대 병기. 진입 시각 기준으로 클라이언트에서 1회 계산.
  // SSR에서는 null (Date.now() 하이드레이션 mismatch 회피), 마운트 시점 lazy init.
  const [expiresAt] = useState<Date | null>(() =>
    typeof window === "undefined"
      ? null
      : new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000),
  );

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
    // §1 재설정 카드 — 절차 전체를 담는 중앙 컨테이너 (폭 360-520px).
    <Card style={{ maxWidth: 520, margin: "0 auto" }}>
      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
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
        <Paragraph style={{ marginBottom: 16 }}>
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
            message={t("saveFailedTitle")}
            description={
              <span>
                {t("saveFailedDescriptionPrefix")}
                <Link href="/password-reset">
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
          rules={[
            { required: true, message: t("passwordRequired") },
            { min: 8, message: t("passwordMin") },
            { max: 64, message: t("passwordMax") },
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            onChange={(event) => setPasswordValue(event.target.value)}
          />
        </Form.Item>

        {/* §3: 비밀번호 규칙 실시간 검증 (강도 + 체크리스트) */}
        <PasswordStrengthMeter password={passwordValue} />

        <Form.Item
          label={t("passwordConfirmLabel")}
          name="passwordConfirm"
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
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              {t("submit")}
            </Button>
            {/* §6: 로그인 화면 복귀 escape */}
            <Link href="/login">
              <Button type="link" block>
                {t("backToLoginButton")}
              </Button>
            </Link>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
