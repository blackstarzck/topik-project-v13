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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { App, Button, Card, Divider, Form, Input, Space, Typography } from "antd";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";

const { Paragraph, Title, Text } = Typography;

// X-12 §5: "받은편지함 열기" — 이메일 도메인별 웹메일 받은편지함 바로가기.
// 매핑에 없는 도메인이면 null (그 경우 버튼 대신 안내 문구만 노출).
const WEBMAIL_INBOX: Record<string, string> = {
  "gmail.com": "https://mail.google.com/mail/u/0/#inbox",
  "naver.com": "https://mail.naver.com",
  "daum.net": "https://mail.daum.net",
  "hanmail.net": "https://mail.daum.net",
  "kakao.com": "https://mail.kakao.com",
  "outlook.com": "https://outlook.live.com/mail/0/inbox",
  "hotmail.com": "https://outlook.live.com/mail/0/inbox",
  "yahoo.com": "https://mail.yahoo.com",
  "icloud.com": "https://www.icloud.com/mail",
};

function inboxUrlForEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  return WEBMAIL_INBOX[domain] ?? null;
}

const COOLDOWN_DEFAULT_SECONDS = 60;
const COOLDOWN_STORAGE_KEY = "talkpik:verify-email:cooldown-until";

// Countdown formatter — phrases come from the shared `auth.countdown.*`
// catalog so minutes/seconds render correctly per locale.
type CountdownTranslate = ReturnType<typeof useTranslations<"auth.countdown">>;

function formatCountdown(
  totalSeconds: number,
  tc: CountdownTranslate,
): string {
  if (totalSeconds <= 0) return tc("zero");
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return tc("seconds", { seconds });
  if (seconds === 0) return tc("minutes", { minutes });
  return tc("minutesSeconds", { minutes, seconds });
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
  const t = useTranslations("auth.verifyEmail");
  const tc = useTranslations("auth.countdown");
  // Cross-namespace: server resend-failure copy lives under `auth.error.<reason>.message`.
  const te = useTranslations("auth.error");
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";

  const [emailValue, setEmailValue] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(() =>
    readCooldownRemaining(),
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return t("resendCountdown", {
      label: formatCountdown(cooldownRemaining, tc),
    });
  }, [cooldownRemaining, t, tc]);

  async function handleResend() {
    const trimmed = emailValue.trim();
    if (!trimmed) {
      message.warning(t("emailRequiredWarning"));
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
        message.error(t("resendRateLimited"));
        return;
      }
      message.error(
        t("resendFailed", {
          message: te(`${code}.message` as Parameters<typeof te>[0]),
        }),
      );
      return;
    }
    writeCooldownStart(COOLDOWN_DEFAULT_SECONDS);
    setCooldownRemaining(COOLDOWN_DEFAULT_SECONDS);
    message.success(t("resendSuccess"));
  }

  return (
    <Card style={{ maxWidth: 520, margin: "0 auto" }} aria-live="polite">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* §1 마스코트/일러스트 — 안내 카피를 가리지 않게 상단, 대체 텍스트 필수 */}
        <AuthMascot alt={t("mascotAlt")} emoji="📬" size={48} />
        <Title level={3} style={{ marginBottom: 0 }}>
          {t("title")}
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>{t("body")}</Paragraph>

        <Text type="secondary">{t("frequentNote")}</Text>

        {emailFromQuery && (
          <Text type="secondary">
            {t("signupEmailPrefix")} <strong>{emailFromQuery}</strong>
          </Text>
        )}

        <Form layout="vertical">
          <Form.Item label={t("resendOtherLabel")} htmlFor="verify-email-input">
            <Input
              id="verify-email-input"
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              placeholder={t("emailPlaceholder")}
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
          {t("resend")}
        </Button>

        {/* §5 이메일 안 왔을 때 안내 — primary 재전송과 시각적 위계 구분(secondary).
            스팸함 확인 / 받은편지함 열기 / 다른 이메일로 가입하기. */}
        <Divider style={{ margin: "4px 0" }} />
        <div data-testid="verify-email-help">
          <Text strong style={{ fontSize: 13 }}>
            {t("noEmailHeading")}
          </Text>
          <Paragraph
            type="secondary"
            style={{ margin: "4px 0 8px", fontSize: 13 }}
          >
            {t("noEmailBody")}
          </Paragraph>
          <Space size="small" wrap>
            {(() => {
              const inboxUrl = inboxUrlForEmail(emailValue || emailFromQuery);
              return inboxUrl ? (
                <Button
                  size="small"
                  href={inboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="verify-email-open-inbox"
                >
                  {t("openInbox")}
                </Button>
              ) : null;
            })()}
            <Link href="/sign-up">
              <Button size="small">{t("signUpDifferentEmail")}</Button>
            </Link>
          </Space>
        </div>

        {/* §6 도움말/escape route — 항상 노출 */}
        <Paragraph style={{ marginBottom: 0, textAlign: "center" }}>
          <Link href="/login">{t("escapeToLogin")}</Link>
          {" · "}
          <Link href="/sign-up">{t("escapeSignUp")}</Link>
          {" · "}
          <Link href="/">{t("escapeHome")}</Link>
        </Paragraph>
      </Space>
    </Card>
  );
}
