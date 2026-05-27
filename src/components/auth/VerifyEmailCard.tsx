"use client";

// Phase 8-D · /auth/verify-email post-signup landing
//
// Persistent landing page after signup that shows the email used, a 60s-
// cooldown resend button (Supabase same-user OTP window: 60s; project cap
// 30/hour OTP; built-in SMTP 2/hour). Survives reloads via ?email= query.
// Resend always requires a visible editable email input (Codex C-ε rule).
//
// Phase 8 follow-up v2.3 (2026-05-27): cooldown은 localStorage timestamp 기반으로
// 새로고침 시에도 유지. 이전 구현은 client state 1초씩 줄이는 방식이라 새로고침
// 시 cooldown 초기화 = 한도 우회 가능했음 (Codex 검수 적발).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Card, Form, Input, Space, Typography } from "antd";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";

const { Paragraph, Title, Text } = Typography;

const COOLDOWN_DEFAULT_SECONDS = 60;
const COOLDOWN_STORAGE_KEY = "talkpik:verify-email:cooldown-until";

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0초";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

/** localStorage에서 cooldown 종료 시각(epoch ms)을 읽어 남은 초로 변환. SSR-safe. */
function readCooldownRemaining(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    const remainingSeconds = Math.ceil((until - Date.now()) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : 0;
  } catch {
    return 0;
  }
}

/** cooldown 시작: 현재 + N초를 localStorage에 저장. */
function writeCooldownStart(seconds: number): void {
  if (typeof window === "undefined") return;
  try {
    if (seconds <= 0) {
      window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      return;
    }
    const until = Date.now() + seconds * 1000;
    window.localStorage.setItem(COOLDOWN_STORAGE_KEY, String(until));
  } catch {
    /* quota / privacy-mode 등 — silent (UI cooldown은 메모리 state로 동작) */
  }
}

/** cooldown 종료: localStorage cleanup. */
function clearCooldown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
  } catch {
    /* silent */
  }
}

export function VerifyEmailCard() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";

  const [emailValue, setEmailValue] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  // SSR-safe 초기값 0. 마운트 후 useEffect에서 localStorage 복원.
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 마운트 시 localStorage에서 cooldown 복원 — 새로고침/탭 재방문에도 cooldown 유지.
  useEffect(() => {
    const initial = readCooldownRemaining();
    if (initial > 0) setCooldownRemaining(initial);
  }, []);

  // tick + 종료 시 localStorage cleanup. tick 자체는 localStorage의 until 기준으로
  // 다시 계산 → drift / 백그라운드 탭 보정.
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      clearCooldown();
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        const fresh = readCooldownRemaining();
        setCooldownRemaining(fresh);
      }, 1000);
    }
    // unmount/effect cleanup — 조건 없이 항상 interval 정리해서 누수 차단.
    // 직전 구현은 cooldownRemaining <= 1일 때만 정리해서 60초 도중 페이지 이탈 시
    // interval이 setState를 unmounted component에 호출하는 누수 발생 가능 (Codex 검수).
    return () => {
      if (timerRef.current) {
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
        // Phase 8 follow-up v2.3 (2026-05-27): HTTP status(429 등)는 cooldown 초가
        // 아니다. 이전 구현이 status 값을 초로 잘못 해석. supabase-js AuthError는
        // Retry-After 헤더를 직접 노출 안 하므로 default 60초 fallback. 진짜
        // Retry-After 값이 필요하면 callback layer에서 query로 받아 처리.
        writeCooldownStart(COOLDOWN_DEFAULT_SECONDS);
        setCooldownRemaining(COOLDOWN_DEFAULT_SECONDS);
        message.error("메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      message.error(`재전송에 실패했어요: ${error.message}`);
      return;
    }
    writeCooldownStart(COOLDOWN_DEFAULT_SECONDS);
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
