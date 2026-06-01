"use client";

// Phase 8-C · /auth/error reason-aware card
//
// Reads `reason`, `email`, `retry_after_seconds` from the URL search params,
// renders the canonical Korean message + primary/secondary CTA, runs a
// Retry-After countdown when applicable, and shows an editable email input
// for resend reasons. Resend always requires user-visible email submission
// (Codex C-ε rule: no fire-and-forget from URL alone).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button, Card, Form, Input, Space, Typography } from "antd";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { buildAuthRedirectUrl } from "@/lib/auth/redirect-url";
import {
  REASON_CONTENT,
  isValidReason,
  mapSupabaseErrorCode,
  sanitizeRetryAfterSeconds,
  type AuthErrorContent,
  type AuthErrorCta,
  type AuthErrorCtaKind,
  type AuthErrorReason,
} from "@/lib/auth/error-mapping";

const { Paragraph, Title, Text } = Typography;

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0초";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

function ctaHref(kind: AuthErrorCtaKind): string {
  switch (kind) {
    case "signup":
      return "/sign-up";
    case "login":
      return "/login";
    case "home":
      return "/";
    case "help":
      // No dedicated help/support surface exists yet (deferred). Help is not a
      // standalone CTA here — see the honest escape-route row below. We keep a
      // home fallback only so a stray help kind never dead-ends.
      return "/";
    case "retry":
      return "/login";
    case "resend":
      return "/sign-up";
  }
}

// description §6 escape routes: 로그인 / 가입 / 홈 — 항상 노출, 최소 1개 escape.
// "도움말" 라벨은 실제 도움말/지원 화면이 없어 misleading 이므로 제거하고,
// 실제 목적지가 있는 정직한 링크만 노출한다.
const ESCAPE_LINKS: { href: string; label: string; kind: AuthErrorCtaKind }[] = [
  { href: "/login", label: "로그인", kind: "login" },
  { href: "/sign-up", label: "가입", kind: "signup" },
  { href: "/", label: "홈", kind: "home" },
];

export function AuthErrorCard() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const reasonParam = searchParams.get("reason");
  const reason: AuthErrorReason = isValidReason(reasonParam)
    ? reasonParam
    : mapSupabaseErrorCode(reasonParam);
  const content: AuthErrorContent = REASON_CONTENT[reason];

  const emailFromQuery = searchParams.get("email") ?? "";
  const initialRetryAfter = sanitizeRetryAfterSeconds(
    searchParams.get("retry_after_seconds"),
  );

  const [remaining, setRemaining] = useState<number | null>(
    content.hasCountdown ? initialRetryAfter ?? 60 : null,
  );
  const [emailValue, setEmailValue] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const countdownLabel = useMemo(() => {
    if (remaining === null) return null;
    if (remaining <= 0) return "지금 다시 시도할 수 있어요";
    return `${formatCountdown(remaining)} 후 다시 시도할 수 있어요`;
  }, [remaining]);

  const primaryDisabled =
    content.hasCountdown && remaining !== null && remaining > 0;

  async function handleResend() {
    const trimmed = emailValue.trim();
    if (!trimmed) {
      message.warning("이메일을 입력해주세요.");
      return;
    }
    setResending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmed,
      options: {
        emailRedirectTo: buildAuthRedirectUrl("/auth/callback?next=/onboarding/learning-goal"),
      },
    });
    setResending(false);
    if (error) {
      const code = mapSupabaseErrorCode(error.code);
      if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
        setRemaining(60);
        message.error("메일을 너무 많이 보냈어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      message.error(`재전송에 실패했어요: ${REASON_CONTENT[mapSupabaseErrorCode(error.code)].message}`);
      return;
    }
    message.success("인증 메일을 다시 보냈어요. 받은편지함을 확인해주세요.");
  }

  function handlePrimaryClick(cta: AuthErrorCta) {
    if (primaryDisabled) return;
    if (cta.kind === "resend") {
      void handleResend();
      return;
    }
    router.push(ctaHref(cta.kind));
  }

  return (
    <Card
      style={{ maxWidth: 520, margin: "0 auto" }}
      aria-live="polite"
      data-testid={`auth-error-card-${reason}`}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Title level={3} style={{ marginBottom: 0 }}>
          {content.title}
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>{content.message}</Paragraph>

        {content.showsEmailField && (
          <Form layout="vertical">
            <Form.Item label="이메일" htmlFor="auth-error-email">
              <Input
                id="auth-error-email"
                type="email"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                placeholder="가입한 이메일을 입력해주세요"
                autoComplete="email"
              />
            </Form.Item>
          </Form>
        )}

        {countdownLabel && (
          <Text type="secondary" data-testid="auth-error-countdown">
            {countdownLabel}
          </Text>
        )}

        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Button
            type="primary"
            block
            disabled={primaryDisabled}
            loading={resending}
            onClick={() => handlePrimaryClick(content.primary)}
            data-testid="auth-error-primary"
          >
            {content.primary.label}
          </Button>
          {/* description §3: primary 1 + secondary <=1. "help" kind은 실제
              도움말 화면이 없어 misleading 이므로 secondary 버튼으로 렌더하지
              않는다 (대신 아래 정직한 escape-route 행으로 안내). */}
          {content.secondary && content.secondary.kind !== "help" && (
            <Link href={ctaHref(content.secondary.kind)} legacyBehavior>
              <Button type="link" block data-testid="auth-error-secondary">
                {content.secondary.label}
              </Button>
            </Link>
          )}
        </Space>

        {/* §6 escape routes — primary/secondary와 같은 목적지(href)는 제외해
            한 화면에 같은 곳으로 가는 affordance가 중복되지 않게 한다. */}
        <Paragraph
          style={{ marginBottom: 0, textAlign: "center" }}
          data-testid="auth-error-escape"
        >
          {ESCAPE_LINKS.filter((link) => {
            const usedHrefs = [
              ctaHref(content.primary.kind),
              content.secondary ? ctaHref(content.secondary.kind) : null,
            ];
            return !usedHrefs.includes(link.href);
          }).map((link, index, visible) => (
            <span key={link.href}>
              <Link href={link.href}>{link.label}</Link>
              {index < visible.length - 1 ? " · " : null}
            </span>
          ))}
        </Paragraph>
      </Space>
    </Card>
  );
}
