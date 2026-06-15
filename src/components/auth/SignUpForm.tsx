"use client";

// Phase 7-B (original) + Phase 8-D (verify-email redirect)
// - After successful sign-up, router.push('/auth/verify-email?email=...')
//   instead of in-place "이메일 확인하세요" state. Verify page handles
//   resend with 60s cooldown and survives reloads/deep-links.

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Typography,
} from "antd";
import { ArrowRight } from "lucide-react";

import { GoogleMark } from "@/components/auth/GoogleMark";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import {
  isGoogleOAuthUnsupportedBrowserError,
  startGoogleOAuth,
  type GoogleOAuthEmbeddedBrowser,
} from "@/lib/auth/oauth";
import {
  DEFAULT_COOLDOWN_SECONDS,
  useEmailCooldown,
} from "@/lib/auth/use-email-cooldown";
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

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

const SIGN_UP_COOLDOWN_STORAGE_KEY = "talkpik:sign-up:cooldown-until";

const { Text } = Typography;

type CountdownTranslate = ReturnType<typeof useTranslations<"auth.countdown">>;

function formatCountdown(totalSeconds: number, tc: CountdownTranslate): string {
  if (totalSeconds <= 0) return tc("zero");
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return tc("seconds", { seconds });
  if (seconds === 0) return tc("minutes", { minutes });
  return tc("minutesSeconds", { minutes, seconds });
}

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
  onCooldownChange?: (isCoolingDown: boolean) => void;
};

export function SignUpForm({
  onTypingChange,
  onPasswordChange,
  onPasswordVisibilityChange,
  onCooldownChange,
}: SignUpFormProps = {}) {
  const t = useTranslations("auth.signUp");
  const toauth = useTranslations("auth.oauth");
  const tc = useTranslations("auth.countdown");
  const tcooldown = useTranslations("auth.cooldown");
  // Cross-namespace: server sign-up failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [blockedOAuthBrowser, setBlockedOAuthBrowser] =
    useState<GoogleOAuthEmbeddedBrowser | null>(null);
  const [safeGuidanceVisible, setSafeGuidanceVisible] = useState(false);
  const signUpCooldown = useEmailCooldown(
    SIGN_UP_COOLDOWN_STORAGE_KEY,
    DEFAULT_COOLDOWN_SECONDS,
  );
  // password-strength meter는 실시간으로 입력값을 추적해야 하므로 watch.
  const [passwordValue, setPasswordValue] = useState("");
  const [form] = Form.useForm<SignUpFields>();
  const isCoolingDown = signUpCooldown.remaining > 0;

  useEffect(() => {
    onCooldownChange?.(isCoolingDown);
  }, [isCoolingDown, onCooldownChange]);

  const countdownLabel = useMemo(() => {
    if (!isCoolingDown) return null;
    return tcooldown("label", {
      label: formatCountdown(signUpCooldown.remaining, tc),
    });
  }, [isCoolingDown, signUpCooldown.remaining, tc, tcooldown]);

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPassword = event.target.value;
    setPasswordValue(nextPassword);
    onPasswordChange?.(nextPassword);
  }

  async function handleSignUp(values: SignUpFields) {
    if (isCoolingDown) return;

    setSafeGuidanceVisible(false);
    setBlockedOAuthBrowser(null);
    setSubmitting(true);
    try {
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
        if (
          error.status === 429 ||
          (error.code && RATE_LIMIT_CODES.has(error.code))
        ) {
          signUpCooldown.start();
          message.error(t("rateLimitedMessage"));
          return;
        }
        // §3 예외: 중복 이메일 여부는 단정하지 않고 보안-safe 안내로 처리한다.
        if (error.code && DUPLICATE_EMAIL_CODES.has(error.code)) {
          form.setFields([{ name: "email", errors: [] }]);
          setSafeGuidanceVisible(true);
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
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(values.email)}`,
      );
    } catch {
      // D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재
      // 시 동기 throw — catch 없이는 unhandled rejection으로 버튼이 영구 로딩.
      message.error(t("signUpFailed", { message: te("unknown.message") }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleSubmitting(true);
    setBlockedOAuthBrowser(null);
    try {
      const { error } = await startGoogleOAuth("sign-up");
      if (error) {
        message.error(t("socialAuthFailed"));
        setGoogleSubmitting(false);
      }
    } catch (error) {
      if (isGoogleOAuthUnsupportedBrowserError(error)) {
        setBlockedOAuthBrowser(error.browser);
      } else {
        message.error(t("socialAuthFailed"));
      }
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="auth-form-stack">
      {blockedOAuthBrowser && (
        <Alert
          type="warning"
          showIcon
          title={toauth("embeddedBrowserTitle", {
            browser: toauth(
              `browser.${blockedOAuthBrowser}` as Parameters<typeof toauth>[0],
            ),
          })}
          description={toauth("embeddedBrowserDescription")}
          className="!mb-0"
          data-testid="oauth-browser-warning"
        />
      )}
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
              setSafeGuidanceVisible(false);
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

        {safeGuidanceVisible && (
          <Alert
            type="info"
            showIcon
            className="!mb-4"
            data-testid="sign-up-safe-guidance"
            title={t("accountCheckTitle")}
            description={
              <div className="flex flex-col gap-3">
                <span>{t("accountCheckDescription")}</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="small"
                    href="/login"
                    data-testid="sign-up-safe-guidance-login"
                  >
                    {t("accountCheckLogin")}
                  </Button>
                  <Button
                    size="small"
                    href="/password-reset"
                    data-testid="sign-up-safe-guidance-reset"
                  >
                    {t("accountCheckReset")}
                  </Button>
                </div>
              </div>
            }
          />
        )}

        {countdownLabel && (
          <Text
            type="secondary"
            className="!mb-4 block text-center"
            data-testid="sign-up-countdown"
          >
            {countdownLabel}
          </Text>
        )}

        <Form.Item className="auth-form-submit">
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isCoolingDown}
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
