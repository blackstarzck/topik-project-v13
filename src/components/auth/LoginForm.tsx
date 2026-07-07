"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  App,
  Alert,
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Segmented,
  Typography,
} from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "@/components/shared/AppIcons";

import { GoogleMark } from "@/components/auth/GoogleMark";
import { POST_AUTH_LOGIN_PATH } from "@/lib/auth/completion-routes";
import {
  isGoogleOAuthUnsupportedBrowserError,
  startGoogleOAuth,
  type GoogleOAuthEmbeddedBrowser,
} from "@/lib/auth/oauth";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode, sanitizeNext } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

// description §1 예외 + §4 예외: 세션 만료 / 휴면 등은 인라인 안내(Alert)로.
// 탈퇴 계정 reason은 로그인 화면 진입 시 전역 Message로 안내한다.
// reason query 로 진입했을 때 보여줄 안내 톤(type) + 번역 키. i18n: 문구는
// 카탈로그(auth.login.notice*)에서 t()로 해석하므로 여기서는 키만 보관한다.
// Translator + key types scoped to the `auth.login` namespace. next-intl's
// type augmentation narrows the accepted key to known `auth.login.*` keys, so
// the notice maps below carry exactly those keys (not bare `string`).
type LoginTranslate = ReturnType<typeof useTranslations<"auth.login">>;
type LoginKey = Parameters<LoginTranslate>[0];

type NoticeTone = "warning" | "info" | "error";
// `key` resolves through the auth.login.* catalog; `text` carries an
// already-localized literal (e.g. a REASON_CONTENT message) verbatim.
type StatusNotice = { tone: NoticeTone; key?: LoginKey; text?: string };

const REASON_NOTICE: Record<string, StatusNotice> = {
  session_expired: { tone: "warning", key: "noticeSessionExpired" },
  dormant: { tone: "info", key: "noticeDormant" },
  withdrawn: { tone: "error", key: "noticeWithdrawn" },
  // 차단(blocked) 계정 게이트는 기존 noticeUserBanned 문구를 재사용한다.
  blocked: { tone: "error", key: "noticeUserBanned" },
};

// 서버에서 받은 인증 실패 코드를 "필드 하단 인라인 오류"로 보여줄지,
// "카드 상단 인라인 안내(Alert)"로 보여줄지 분류한다 (description §3 vs §4).
const FIELD_LEVEL_CODES = new Set([
  "invalid_credentials",
  "invalid_login_credentials",
  "validation_failed",
]);

const STATUS_NOTICE_BY_CODE: Record<string, StatusNotice> = {
  email_not_confirmed: { tone: "warning", key: "noticeEmailNotConfirmed" },
  user_banned: { tone: "error", key: "noticeUserBanned" },
  // 서버/네트워크 계열은 별도 분기에서 처리하지만, 명시적 fallback 도 준비.
};

type LoginMode = "password" | "magic-link";

type PasswordFields = { email: string; password: string };
type MagicLinkFields = { email: string };

type LoginFormProps = {
  onTypingChange?: (isTyping: boolean) => void;
  onPasswordChange?: (password: string) => void;
  onPasswordVisibilityChange?: (visible: boolean) => void;
};

// Codex P4 D5 결정: 잠금은 서버 강제 (Supabase over_request_rate_limit → X-11 카드).
// 클라이언트는 보안 장치가 아닌 사용자 안내용 실패 카운터만 둠. 우회 가능해도 보안에
// 영향 없음. 사용자가 "다시 시도해도 안 될 수 있다" 는 신호를 미리 받게 함.
const FAILED_ATTEMPTS_HINT_THRESHOLD = 3;

export function LoginForm({
  onTypingChange,
  onPasswordChange,
  onPasswordVisibilityChange,
}: LoginFormProps = {}) {
  const t = useTranslations("auth.login");
  const toauth = useTranslations("auth.oauth");
  // Cross-namespace: server auth-failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeReason = searchParams.get("reason");
  // §1/§4 예외: reason query 기반 인라인 안내 (세션 만료/휴면/탈퇴).
  const queryNotice = noticeReason ? REASON_NOTICE[noticeReason] : undefined;
  // 로그인 성공 후 이동 경로: ?next 가 있으면(예: 약관 재동의 딥링크) 그 곳으로,
  // 없으면 /dashboard. 외부 URL/스킴은 sanitizeNext 가 차단한다.
  const nextTarget = sanitizeNext(searchParams.get("next"), "/dashboard");
  const postAuthNextTarget = searchParams.get("next")
    ? nextTarget
    : POST_AUTH_LOGIN_PATH;
  const [mode, setMode] = useState<LoginMode>("password");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  // 로그인 시도 후 서버가 돌려준 상태성 오류(휴면/미인증/서버오류)를 위한 인라인 안내.
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [blockedOAuthBrowser, setBlockedOAuthBrowser] =
    useState<GoogleOAuthEmbeddedBrowser | null>(null);
  const [form] = Form.useForm<PasswordFields | MagicLinkFields>();
  const shownQueryMessageRef = useRef<string | null>(null);

  const shouldMessageWithdrawn = noticeReason === "withdrawn";
  const withdrawnMessage = shouldMessageWithdrawn ? queryNotice : undefined;
  // 화면 상단에 노출할 최종 안내: 시도 후 statusNotice가 query 안내보다 우선.
  const activeNotice =
    statusNotice ?? (shouldMessageWithdrawn ? null : queryNotice) ?? null;

  useEffect(() => {
    if (!withdrawnMessage) {
      shownQueryMessageRef.current = null;
      return;
    }

    const noticeText =
      withdrawnMessage.text ??
      (withdrawnMessage.key ? t(withdrawnMessage.key) : "");
    if (!noticeText) return;

    const messageKey = `login-reason-${noticeReason}`;
    if (shownQueryMessageRef.current === messageKey) return;

    shownQueryMessageRef.current = messageKey;
    message[withdrawnMessage.tone]({
      key: messageKey,
      content: noticeText,
    });
  }, [message, noticeReason, t, withdrawnMessage]);

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    onPasswordChange?.(event.target.value);
  }

  async function handlePasswordLogin(values: PasswordFields) {
    setSubmitting(true);
    setStatusNotice(null);
    setBlockedOAuthBrowser(null);
    const supabase = createSupabaseBrowserClient();
    let result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      result = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
    } catch {
      // 네트워크/서버 오류 — §4 예외: 서버 오류 인라인 안내.
      setSubmitting(false);
      setFailedAttempts((prev) => prev + 1);
      setStatusNotice({ tone: "error", key: "networkError" });
      return;
    }
    const { error } = result;
    setSubmitting(false);
    if (error) {
      setFailedAttempts((prev) => prev + 1);
      const code = error.code ?? "";
      // §4: 휴면/탈퇴/미인증/제한 등 상태성 오류는 카드 상단 인라인 안내로.
      const statusMatch = STATUS_NOTICE_BY_CODE[code];
      if (statusMatch) {
        setStatusNotice(statusMatch);
        return;
      }
      // §3: 잘못된 자격 증명은 필드 하단 인라인 오류로.
      if (!code || FIELD_LEVEL_CODES.has(code)) {
        form.setFields([
          {
            name: "password",
            errors: [t("invalidCredentials")],
          },
        ]);
        return;
      }
      // 그 외(서버측 알 수 없는 오류)는 상단 인라인 안내.
      const reason = mapSupabaseErrorCode(code);
      setStatusNotice({
        tone: "error",
        text: te(`${reason}.message` as Parameters<typeof te>[0]),
      });
      return;
    }
    setFailedAttempts(0);
    router.push(nextTarget);
  }

  async function handleMagicLink(values: MagicLinkFields) {
    setSubmitting(true);
    setBlockedOAuthBrowser(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: buildAuthRedirectUrl(
            `/auth/callback?next=${encodeURIComponent(postAuthNextTarget)}`,
          ),
        },
      });
      if (error) {
        const reason = mapSupabaseErrorCode(error.code);
        message.error(
          t("magicLinkSendFailed", {
            message: te(`${reason}.message` as Parameters<typeof te>[0]),
          }),
        );
        return;
      }
      setMagicLinkSent(values.email);
    } catch {
      // D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재
      // 시 동기 throw — catch 없이는 unhandled rejection으로 버튼이 영구 로딩.
      message.error(
        t("magicLinkSendFailed", { message: te("unknown.message") }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleSubmitting(true);
    setStatusNotice(null);
    setBlockedOAuthBrowser(null);
    try {
      const { error } = await startGoogleOAuth("login", postAuthNextTarget);
      if (error) {
        const reason = mapSupabaseErrorCode(error.code);
        setStatusNotice({
          tone: "error",
          text: te(`${reason}.message` as Parameters<typeof te>[0]),
        });
        setGoogleSubmitting(false);
      }
    } catch (error) {
      if (isGoogleOAuthUnsupportedBrowserError(error)) {
        setBlockedOAuthBrowser(error.browser);
      } else {
        setStatusNotice({ tone: "error", key: "socialAuthFailed" });
      }
      setGoogleSubmitting(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="text-center">
        <Title level={3}>{t("magicLinkSentTitle")}</Title>
        <Paragraph>
          {t.rich("magicLinkSentBody", {
            email: magicLinkSent,
            strong: (chunks) => <strong>{chunks}</strong>,
            br: () => <br />,
          })}
        </Paragraph>
        <Button onClick={() => setMagicLinkSent(null)}>{t("tryAgain")}</Button>
      </div>
    );
  }

  return (
    <div className="auth-form-stack">
      {activeNotice && (
        <Alert
          type={activeNotice.tone}
          showIcon
          title={
            activeNotice.text ?? (activeNotice.key ? t(activeNotice.key) : "")
          }
          className="!mb-0"
          data-testid="login-session-notice"
        />
      )}
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
      {failedAttempts >= FAILED_ATTEMPTS_HINT_THRESHOLD && (
        <Alert
          type="info"
          showIcon
          title={t("failedAttemptsHint")}
          className="!mb-0"
          data-testid="login-failed-hint"
        />
      )}
      <Segmented
        block
        value={mode}
        onChange={(v) => {
          setMode(v as LoginMode);
          form.resetFields();
          setFailedAttempts(0);
          setStatusNotice(null);
          setBlockedOAuthBrowser(null);
          onTypingChange?.(false);
          onPasswordChange?.("");
          onPasswordVisibilityChange?.(false);
        }}
        options={[
          { label: t("modePassword"), value: "password" },
          { label: t("modeMagicLink"), value: "magic-link" },
        ]}
        className="!mb-0"
      />

      <Form
        form={form as FormInstance<PasswordFields | MagicLinkFields>}
        layout="vertical"
        onFinish={(values) => {
          if (mode === "password") {
            void handlePasswordLogin(values as PasswordFields);
            return;
          }
          void handleMagicLink(values as MagicLinkFields);
        }}
        requiredMark={false}
        className="auth-login-form"
      >
        <div className="auth-login-mode-panel">
          {mode === "password" ? (
            <>
              <Form.Item
                label={t("emailLabel")}
                name="email"
                rules={[
                  { required: true, message: t("emailRequired") },
                  { type: "email", message: t("emailInvalid") },
                ]}
              >
                <Input
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  prefix={
                    <Mail
                      className="auth-input-icon"
                      size={18}
                      aria-hidden="true"
                    />
                  }
                  onFocus={() => onTypingChange?.(true)}
                  onBlur={() => onTypingChange?.(false)}
                />
              </Form.Item>
              <Form.Item
                label={t("passwordLabel")}
                name="password"
                rules={[{ required: true, message: t("passwordRequired") }]}
              >
                <Input.Password
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  prefix={
                    <LockKeyhole
                      className="auth-input-icon"
                      size={18}
                      aria-hidden="true"
                    />
                  }
                  onFocus={() => onTypingChange?.(true)}
                  onBlur={() => onTypingChange?.(false)}
                  onChange={handlePasswordChange}
                  visibilityToggle={{
                    onVisibleChange: (visible) =>
                      onPasswordVisibilityChange?.(visible),
                  }}
                />
              </Form.Item>
              <div className="auth-form-options-row">
                <Checkbox defaultChecked className="auth-form-remember">
                  {t("rememberMe")}
                </Checkbox>
                <Paragraph className="auth-form-forgot">
                  <Link href="/password-reset">{t("forgotPassword")}</Link>
                </Paragraph>
              </div>
            </>
          ) : (
            <Form.Item
              label={t("emailLabel")}
              name="email"
              rules={[
                { required: true, message: t("emailRequired") },
                { type: "email", message: t("emailInvalid") },
              ]}
            >
              <Input
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                prefix={
                  <Mail
                    className="auth-input-icon"
                    size={18}
                    aria-hidden="true"
                  />
                }
                onFocus={() => onTypingChange?.(true)}
                onBlur={() => onTypingChange?.(false)}
              />
            </Form.Item>
          )}
        </div>

        <div className="auth-login-action-panel">
          <Form.Item className="auth-form-submit">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              icon={<ArrowRight size={16} aria-hidden="true" />}
              iconPlacement="end"
            >
              {mode === "password" ? t("submit") : t("magicLinkSubmit")}
            </Button>
          </Form.Item>

          <Divider plain className="auth-form-divider">
            {t("socialDivider")}
          </Divider>

          <div className="flex flex-col gap-2">
            <Button
              block
              htmlType="button"
              onClick={() => void handleGoogleLogin()}
              loading={googleSubmitting}
              disabled={submitting}
              icon={<GoogleMark />}
              className="signup-social-button"
            >
              {t("socialGoogle")}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
}
