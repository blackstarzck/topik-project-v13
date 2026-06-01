"use client";

import { useState } from "react";
import { App, Button, Form, Input, Typography } from "antd";

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
        message.error("메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      message.error(`전송 실패: ${REASON_CONTENT[code].message}`);
      return;
    }
    cooldown.start();
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div>
        <Title level={3}>이메일을 확인하세요</Title>
        <Paragraph>
          <strong>{sentTo}</strong> 로 비밀번호 재설정 링크를 보냈습니다. 메일
          안의 링크를 누르면 새 비밀번호 설정 화면으로 이동합니다.
        </Paragraph>
        {/* description §4: 링크 만료/재전송 안내. 서버의 정확한 만료 시각은
            클라이언트에 없어 가짜 절대 시간을 만들지 않고 상대 시간만 안내. */}
        <Paragraph>
          <Text type="secondary">
            보안을 위해 링크는 약 1시간 후 만료돼요. 만료되면 이 화면에서 다시
            보낼 수 있어요.
          </Text>
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
      <Paragraph>
        가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
      </Paragraph>
      <Form.Item
        label="이메일"
        name="email"
        rules={[
          { required: true, message: "이메일을 입력하세요" },
          { type: "email", message: "올바른 이메일 형식이 아닙니다" },
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
          재설정 링크 보내기
        </Button>
      </Form.Item>
    </Form>
  );
}
