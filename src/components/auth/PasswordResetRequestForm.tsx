"use client";

import { useState } from "react";
import { App, Button, Form, Input, Typography } from "antd";
import { useTranslations } from "next-intl";

import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { REASON_CONTENT, mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DEFAULT_COOLDOWN_SECONDS,
  useEmailCooldown,
} from "@/lib/auth/use-email-cooldown";

const { Paragraph, Text, Title } = Typography;

type Fields = { email: string };

// Codex P4 D7 — X-12 cooldown 패턴 이식. localStorage 기반 60초 cooldown,
// 새로고침에도 유지. rate-limit (over_email_send_rate_limit / over_request_rate_limit)
// 도 동일 cooldown 적용해서 사용자가 "왜 안 보내지는지" 즉시 파악 가능.
const COOLDOWN_STORAGE_KEY = "talkpik:password-reset:cooldown-until";

export function PasswordResetRequestForm() {
  const t = useTranslations("auth.passwordReset");
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const cooldown = useEmailCooldown(
    COOLDOWN_STORAGE_KEY,
    DEFAULT_COOLDOWN_SECONDS,
  );

  async function handleSubmit(values: Fields) {
    if (cooldown.remaining > 0) return;
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: buildAuthRedirectUrl("/password-reset/confirm"),
    });
    setSubmitting(false);
    if (error) {
      const code = mapSupabaseErrorCode(error.code);
      if (
        code === "over_email_send_rate_limit" ||
        code === "over_request_rate_limit"
      ) {
        cooldown.start();
        message.error(t("rateLimited"));
        return;
      }
      message.error(t("sendFailed", { message: REASON_CONTENT[code].message }));
      return;
    }
    cooldown.start();
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div>
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
        {cooldown.countdownLabel && (
          <Text type="secondary" data-testid="password-reset-countdown">
            {cooldown.countdownLabel}
          </Text>
        )}
      </div>
    );
  }

  return (
    <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
      <Paragraph>{t("intro")}</Paragraph>
      <Form.Item
        label={t("emailLabel")}
        name="email"
        rules={[
          { required: true, message: t("emailRequired") },
          { type: "email", message: t("emailInvalid") },
        ]}
      >
        <Input autoComplete="email" disabled={cooldown.remaining > 0} />
      </Form.Item>
      {cooldown.countdownLabel && (
        <Paragraph style={{ marginBottom: 12 }}>
          <Text type="secondary" data-testid="password-reset-countdown">
            {cooldown.countdownLabel}
          </Text>
        </Paragraph>
      )}
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={cooldown.remaining > 0}
        >
          {t("submit")}
        </Button>
      </Form.Item>
    </Form>
  );
}
