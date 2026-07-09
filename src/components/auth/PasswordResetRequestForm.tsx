"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { buildAuthCallbackUrl } from "@/lib/auth/redirect-url";
import { APP_ROUTES } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DEFAULT_COOLDOWN_SECONDS,
  useEmailCooldown,
} from "@/lib/auth/use-email-cooldown";

const { Paragraph, Text, Title } = Typography;

type Fields = { email: string };
type PasswordResetRequestFormProps = {
  initialEmail?: string;
};

// Cooldown label formatter — duration phrases come from the shared
// `auth.countdown.*` catalog, wrapped by `auth.cooldown.label` so the resend
// reminder ("…후 다시 보낼 수 있어요") renders correctly per locale.
type CountdownTranslate = ReturnType<typeof useTranslations<"auth.countdown">>;

function formatCountdown(totalSeconds: number, tc: CountdownTranslate): string {
  if (totalSeconds <= 0) return tc("zero");
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return tc("seconds", { seconds });
  if (seconds === 0) return tc("minutes", { minutes });
  return tc("minutesSeconds", { minutes, seconds });
}

// Codex P4 D7 — X-12 cooldown 패턴 이식. localStorage 기반 60초 cooldown,
// 새로고침에도 유지. rate-limit (over_email_send_rate_limit / over_request_rate_limit)
// 도 동일 cooldown 적용해서 사용자가 "왜 안 보내지는지" 즉시 파악 가능.
const COOLDOWN_STORAGE_KEY = "talkpik:password-reset:cooldown-until";

function normalizeEmail(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function PasswordResetRequestForm({
  initialEmail,
}: PasswordResetRequestFormProps = {}) {
  const t = useTranslations("auth.passwordReset");
  // Cross-namespace: server send-failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const tc = useTranslations("auth.countdown");
  const tcd = useTranslations("auth.cooldown");
  const { message } = App.useApp();
  const [form] = Form.useForm<Fields>();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const normalizedInitialEmail = useMemo(
    () => normalizeEmail(initialEmail),
    [initialEmail],
  );
  const cooldown = useEmailCooldown(
    COOLDOWN_STORAGE_KEY,
    DEFAULT_COOLDOWN_SECONDS,
  );

  // Resend reminder label, formatted from the raw remaining seconds the hook
  // exposes. null while no cooldown is active.
  const countdownLabel = useMemo(() => {
    if (cooldown.remaining <= 0) return null;
    return tcd("label", { label: formatCountdown(cooldown.remaining, tc) });
  }, [cooldown.remaining, tc, tcd]);

  useEffect(() => {
    if (!normalizedInitialEmail) return;
    form.setFieldsValue({ email: normalizedInitialEmail });
  }, [form, normalizedInitialEmail]);

  useEffect(() => {
    if (normalizedInitialEmail) return;
    let ignore = false;

    async function fillFromCurrentUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        const email = normalizeEmail(data.user?.email);
        if (!ignore && email) {
          form.setFieldsValue({ email });
        }
      } catch {
        // Public password reset still works without a current session.
      }
    }

    void fillFromCurrentUser();

    return () => {
      ignore = true;
    };
  }, [form, normalizedInitialEmail]);

  async function handleSubmit(values: Fields) {
    if (submitting || cooldown.remaining > 0) return;
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        values.email,
        {
          redirectTo: buildAuthCallbackUrl(APP_ROUTES.passwordResetConfirm),
        },
      );
      if (error) {
        cooldown.start();
        setSentTo(values.email);
        return;
      }
      cooldown.start();
      setSentTo(values.email);
    } catch {
      // D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재
      // 시 동기 throw — catch 없이는 unhandled rejection으로 버튼이 영구 로딩.
      message.error(t("sendFailed", { message: te("unknown.message") }));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div data-testid="password-reset-sent-state">
        <Title level={3}>{t("sentTitle")}</Title>
        <Paragraph>
          {t.rich("sentBody", {
            email: sentTo,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </Paragraph>
        {/* description §4: 링크 만료/재전송 안내. 서버의 정확한 만료 시각은
            클라이언트에 없어 가짜 절대 시간을 만들지 않고 상대 시간만 안내. */}
        <Paragraph>
          <Text type="secondary">{t("sentExpiryNote")}</Text>
        </Paragraph>
        {countdownLabel && (
          <Text type="secondary" data-testid="password-reset-countdown">
            {countdownLabel}
          </Text>
        )}
        <Paragraph className="password-reset-login-return">
          <Link href="/login">{t("backToLogin")}</Link>
        </Paragraph>
      </div>
    );
  }

  return (
    <Form
      form={form}
      initialValues={
        normalizedInitialEmail ? { email: normalizedInitialEmail } : undefined
      }
      data-testid="password-reset-request-form"
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark={false}
      className="password-reset-request-form"
    >
      <Form.Item
        className="password-reset-email-item"
        label={t("emailLabel")}
        name="email"
        rules={[
          { required: true, message: t("emailRequired") },
          { type: "email", message: t("emailInvalid") },
        ]}
        extra={
          <div
            data-testid="password-reset-guidance"
            className="password-reset-guide"
          >
            <span className="password-reset-guide__line">{t("intro")}</span>
            <span className="password-reset-guide__line">
              {t("sentExpiryNote")}
            </span>
          </div>
        }
      >
        <Input autoComplete="email" disabled={cooldown.remaining > 0} />
      </Form.Item>
      {countdownLabel && (
        <Paragraph className="!mb-3">
          <Text type="secondary" data-testid="password-reset-countdown">
            {countdownLabel}
          </Text>
        </Paragraph>
      )}
      <Form.Item className="password-reset-submit">
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={submitting || cooldown.remaining > 0}
        >
          {t("submit")}
        </Button>
      </Form.Item>
      <Paragraph className="password-reset-login-return">
        <Link href="/login">{t("backToLogin")}</Link>
      </Paragraph>
    </Form>
  );
}
