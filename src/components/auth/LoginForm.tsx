"use client";

import { useState } from "react";
import { App, Alert, Button, Form, Input, Segmented, Typography } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Title } = Typography;

// description §1 예외 + §4 예외: 세션 만료 / 휴면 / 탈퇴 등은 인라인 안내(Alert)로.
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

// Codex P4 D5 결정: 잠금은 서버 강제 (Supabase over_request_rate_limit → X-11 카드).
// 클라이언트는 보안 장치가 아닌 사용자 안내용 실패 카운터만 둠. 우회 가능해도 보안에
// 영향 없음. 사용자가 "다시 시도해도 안 될 수 있다" 는 신호를 미리 받게 함.
const FAILED_ATTEMPTS_HINT_THRESHOLD = 3;

export function LoginForm() {
  const t = useTranslations("auth.login");
  // Cross-namespace: server auth-failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeReason = searchParams.get("reason");
  // §1/§4 예외: reason query 기반 인라인 안내 (세션 만료/휴면/탈퇴).
  const queryNotice = noticeReason ? REASON_NOTICE[noticeReason] : undefined;
  const [mode, setMode] = useState<LoginMode>("password");
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  // 로그인 시도 후 서버가 돌려준 상태성 오류(휴면/미인증/서버오류)를 위한 인라인 안내.
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [form] = Form.useForm<PasswordFields | MagicLinkFields>();

  // 화면 상단에 노출할 최종 안내: 시도 후 statusNotice가 query 안내보다 우선.
  const activeNotice = statusNotice ?? queryNotice ?? null;

  async function handlePasswordLogin(values: PasswordFields) {
    setSubmitting(true);
    setStatusNotice(null);
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
    router.push("/dashboard");
  }

  async function handleMagicLink(values: MagicLinkFields) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(
          "/auth/callback?next=/dashboard",
        ),
      },
    });
    setSubmitting(false);
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
  }

  if (magicLinkSent) {
    return (
      <div>
        <Title level={3}>{t("magicLinkSentTitle")}</Title>
        <Paragraph>
          {t.rich("magicLinkSentBody", {
            email: magicLinkSent,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </Paragraph>
        <Button onClick={() => setMagicLinkSent(null)}>{t("tryAgain")}</Button>
      </div>
    );
  }

  return (
    <div>
      {activeNotice && (
        <Alert
          type={activeNotice.tone}
          showIcon
          title={
            activeNotice.text ?? (activeNotice.key ? t(activeNotice.key) : "")
          }
          style={{ marginBottom: 16 }}
          data-testid="login-session-notice"
        />
      )}
      {failedAttempts >= FAILED_ATTEMPTS_HINT_THRESHOLD && (
        <Alert
          type="info"
          showIcon
          title={t("failedAttemptsHint")}
          style={{ marginBottom: 16 }}
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
        }}
        options={[
          { label: t("modePassword"), value: "password" },
          { label: t("modeMagicLink"), value: "magic-link" },
        ]}
        style={{ marginBottom: 16 }}
      />

      {mode === "password" ? (
        <Form
          form={form as FormInstance<PasswordFields>}
          layout="vertical"
          onFinish={handlePasswordLogin}
          requiredMark={false}
        >
          <Form.Item
            label={t("emailLabel")}
            name="email"
            rules={[
              { required: true, message: t("emailRequired") },
              { type: "email", message: t("emailInvalid") },
            ]}
          >
            <Input autoComplete="email" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item
            label={t("passwordLabel")}
            name="password"
            rules={[{ required: true, message: t("passwordRequired") }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              {t("submit")}
            </Button>
          </Form.Item>
          <Paragraph style={{ textAlign: "center" }}>
            <Link href="/password-reset">{t("forgotPassword")}</Link>
          </Paragraph>
        </Form>
      ) : (
        <Form
          form={form as FormInstance<MagicLinkFields>}
          layout="vertical"
          onFinish={handleMagicLink}
          requiredMark={false}
        >
          <Form.Item
            label={t("emailLabel")}
            name="email"
            rules={[
              { required: true, message: t("emailRequired") },
              { type: "email", message: t("emailInvalid") },
            ]}
          >
            <Input autoComplete="email" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              {t("magicLinkSubmit")}
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
}
