"use client";

// Phase 7-B (original) + Phase 8-D (verify-email redirect)
// - After successful sign-up, router.push('/auth/verify-email?email=...')
//   instead of in-place "이메일 확인하세요" state. Verify page handles
//   resend with 60s cooldown and survives reloads/deep-links.

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Checkbox, Divider, Form, Input } from "antd";
import { ArrowRight } from "lucide-react";

import { GoogleMark } from "@/components/auth/GoogleMark";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { startGoogleOAuth } from "@/lib/auth/oauth";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

// description §3 예외: "중복 이메일/형식 오류는 필드 하단에 표시함."
// Supabase가 가입 중복을 알리는 error.code 들. 이 코드는 토스트가 아니라
// 이메일 필드 하단 인라인 오류로 보여준다.
const DUPLICATE_EMAIL_CODES = new Set([
  "user_already_exists",
  "email_exists",
  "email_address_already_in_use",
]);

type SignUpFields = {
  email: string;
  password: string;
  passwordConfirm: string;
  displayName: string;
  terms: boolean;
};

type SignUpFormProps = {
  onTypingChange?: (isTyping: boolean) => void;
  onPasswordChange?: (password: string) => void;
  onPasswordVisibilityChange?: (visible: boolean) => void;
};

export function SignUpForm({
  onTypingChange,
  onPasswordChange,
  onPasswordVisibilityChange,
}: SignUpFormProps = {}) {
  const t = useTranslations("auth.signUp");
  // Cross-namespace: server sign-up failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  // password-strength meter는 실시간으로 입력값을 추적해야 하므로 watch.
  const [passwordValue, setPasswordValue] = useState("");
  const [form] = Form.useForm<SignUpFields>();

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPassword = event.target.value;
    setPasswordValue(nextPassword);
    onPasswordChange?.(nextPassword);
  }

  async function handleSignUp(values: SignUpFields) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: buildAuthRedirectUrl(
          "/auth/callback?next=/onboarding/learning-goal",
        ),
      },
    });

    if (error) {
      setSubmitting(false);
      // §3 예외: 중복 이메일은 토스트가 아니라 이메일 필드 하단 인라인 오류로.
      if (error.code && DUPLICATE_EMAIL_CODES.has(error.code)) {
        form.setFields([
          {
            name: "email",
            errors: [t("emailDuplicate")],
          },
        ]);
        return;
      }
      const reason = mapSupabaseErrorCode(error.code);
      message.error(
        t("signUpFailed", {
          message: te(`${reason}.message` as Parameters<typeof te>[0]),
        }),
      );
      return;
    }
    router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  async function handleGoogleSignUp() {
    setGoogleSubmitting(true);
    try {
      const { error } = await startGoogleOAuth("sign-up");
      if (error) {
        message.error(t("socialAuthFailed"));
        setGoogleSubmitting(false);
      }
    } catch {
      message.error(t("socialAuthFailed"));
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="auth-form-stack">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSignUp}
        requiredMark={false}
      >
        {/* description §3 입력 순서: 이름, 이메일, 비밀번호 */}
        <Form.Item
          label={t("nameLabel")}
          name="displayName"
          rules={[
            { required: true, message: t("nameRequired") },
            { min: 2, message: t("nameMin") },
            { max: 30, message: t("nameMax") },
          ]}
        >
          <Input
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
          />
        </Form.Item>

        <Form.Item
          label={t("emailLabel")}
          name="email"
          rules={[
            { required: true, message: t("emailRequired") },
            { type: "email", message: t("emailInvalid") },
            { max: 80, message: t("emailMax") },
          ]}
        >
          <Input
            autoComplete="email"
            placeholder="you@example.com"
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
            // 사용자가 이메일을 고치면 직전 "중복 이메일" 서버 오류는 지운다.
            onChange={() => {
              if (form.getFieldError("email").length > 0) {
                form.setFields([{ name: "email", errors: [] }]);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label={t("passwordLabel")}
          name="password"
          rules={[
            { required: true, message: t("passwordRequired") },
            { min: 8, message: t("passwordMin") },
            { max: 64, message: t("passwordMax") },
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
            onChange={handlePasswordChange}
            visibilityToggle={{
              onVisibleChange: (visible) =>
                onPasswordVisibilityChange?.(visible),
            }}
          />
        </Form.Item>

        {/* A-01 피드백: 비밀번호 강도 실시간 표시 */}
        <PasswordStrengthMeter password={passwordValue} showWhenEmpty />

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
          <Input.Password
            autoComplete="new-password"
            onFocus={() => onTypingChange?.(true)}
            onBlur={() => onTypingChange?.(false)}
          />
        </Form.Item>

        <Form.Item
          name="terms"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("termsRequired"))),
            },
          ]}
        >
          <Checkbox>
            {t.rich("termsAgreement", {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {chunks}
                </Link>
              ),
            })}
          </Checkbox>
        </Form.Item>

        <Form.Item className="auth-form-submit">
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={submitting}
            icon={<ArrowRight size={16} aria-hidden="true" />}
            iconPlacement="end"
          >
            {t("submit")}
          </Button>
        </Form.Item>
      </Form>

      <Divider plain className="auth-form-divider">
        {t("socialDivider")}
      </Divider>

      <Button
        block
        onClick={() => void handleGoogleSignUp()}
        loading={googleSubmitting}
        disabled={submitting}
        icon={<GoogleMark />}
        className="signup-social-button"
      >
        {t("socialGoogle")}
      </Button>
    </div>
  );
}
