"use client";

// Phase 8-D · /auth/verify-email post-signup landing
//
// Persistent landing page after signup that shows the email used, a 60s-
// cooldown resend button (Supabase same-user OTP window: 60s; project cap
// 30/hour OTP; built-in SMTP 2/hour). Survives reloads via ?email= query.
// Resend always requires a visible editable email input (Codex C-ε rule).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Card, Form, Input, Space, Typography } from "antd";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode, sanitizeRetryAfterSeconds } from "@/lib/auth/error-mapping";

const { Paragraph, Title, Text } = Typography;

const COOLDOWN_DEFAULT_SECONDS = 60;

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0초";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

export function VerifyEmailCard() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";

  const [emailValue, setEmailValue] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current && cooldownRemaining <= 1) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [cooldownRemaining]);

  const countdownLabel = useMemo(() => {
    if (cooldownRemaining <= 0) return null;
    return `${formatCountdown(cooldownRemaining)} 후 다시 보낼 수 있어요`;
  }, [cooldownRemaining]);

  async function handleResend() {
    const trimmed = emailValue.trim();
    if (!trimmed) {
      message.warning("이메일을 입력해주세요.");
      return;
    }
    if (cooldownRemaining > 0) return;

    setResending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmed,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(
          "/auth/callback?next=/onboarding/learning-goal",
        ),
      },
    });
    setResending(false);

    if (error) {
      const code = mapSupabaseErrorCode(error.code);
      if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
        const explicit = sanitizeRetryAfterSeconds(
          error.status ? String(error.status) : null,
        );
        setCooldownRemaining(explicit ?? COOLDOWN_DEFAULT_SECONDS);
        message.error("메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      message.error(`재전송에 실패했어요: ${error.message}`);
      return;
    }
    setCooldownRemaining(COOLDOWN_DEFAULT_SECONDS);
    message.success("인증 메일을 다시 보냈어요. 받은편지함을 확인해주세요.");
  }

  return (
    <Card style={{ maxWidth: 520, margin: "0 auto" }} aria-live="polite">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Title level={3} style={{ marginBottom: 0 }}>
          이메일을 확인해주세요
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>
          가입을 마무리하려면 받은편지함의 인증 메일에서 링크를 눌러주세요.
          메일이 보이지 않으면 스팸함도 확인해주세요.
        </Paragraph>

        {emailFromQuery && (
          <Text type="secondary">
            가입 이메일: <strong>{emailFromQuery}</strong>
          </Text>
        )}

        <Form layout="vertical">
          <Form.Item label="다른 이메일로 다시 보내려면" htmlFor="verify-email-input">
            <Input
              id="verify-email-input"
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              placeholder="가입한 이메일을 입력해주세요"
              autoComplete="email"
              disabled={cooldownRemaining > 0 || resending}
            />
          </Form.Item>
        </Form>

        {countdownLabel && (
          <Text type="secondary" data-testid="verify-email-countdown">
            {countdownLabel}
          </Text>
        )}

        <Button
          type="primary"
          block
          disabled={cooldownRemaining > 0}
          loading={resending}
          onClick={() => void handleResend()}
          data-testid="verify-email-resend"
        >
          인증 메일 다시 보내기
        </Button>

        <Paragraph style={{ marginBottom: 0, textAlign: "center" }}>
          <Link href="/login">로그인 페이지로</Link>
          {" · "}
          <Link href="/sign-up">다른 이메일로 가입</Link>
          {" · "}
          <Link href="/">홈으로</Link>
        </Paragraph>
      </Space>
    </Card>
  );
}
