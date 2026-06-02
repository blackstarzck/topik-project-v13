"use client";

// Phase 8-C · /auth/error reason-aware card
//
// Reads `reason`, `email`, `retry_after_seconds` from the URL search params,
// renders the canonical Korean message + primary/secondary CTA, runs a
// Retry-After countdown when applicable, and shows an editable email input
// for resend reasons. Resend always requires user-visible email submission
// (Codex C-ε rule: no fire-and-forget from URL alone).

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

// Countdown formatter — phrases are pulled from the shared `auth.countdown.*`
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
// 실제 목적지가 있는 정직한 링크만 노출한다. i18n: 라벨은 auth.error.escape*
// 키로 보관하고 렌더 시점에 t()로 해석한다.
const ESCAPE_LINKS: {
  href: string;
  labelKey: "escapeLogin" | "escapeSignUp" | "escapeHome";
  kind: AuthErrorCtaKind;
}[] = [
  { href: "/login", labelKey: "escapeLogin", kind: "login" },
  { href: "/sign-up", labelKey: "escapeSignUp", kind: "signup" },
  { href: "/", labelKey: "escapeHome", kind: "home" },
];

export function AuthErrorCard() {
  const t = useTranslations("auth.error");
  const tc = useTranslations("auth.countdown");
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const reasonParam = searchParams.get("reason");
  const reason: AuthErrorReason = isValidReason(reasonParam)
    ? reasonParam
    : mapSupabaseErrorCode(reasonParam);
  const content: AuthErrorContent = REASON_CONTENT[reason];

  // Per-reason copy lives in the `auth.error.<reason>.*` catalog; resolve it
  // with a dynamic-key t() (cast required because the key is computed).
  type ErrorKey = Parameters<typeof t>[0];
  const reasonTitle = t(`${reason}.title` as ErrorKey);
  const reasonMessage = t(`${reason}.message` as ErrorKey);
  const reasonPrimaryLabel = t(`${reason}.primaryLabel` as ErrorKey);

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
    if (remaining <= 0) return t("countdownReady");
    return t("countdownWaiting", { label: formatCountdown(remaining, tc) });
  }, [remaining, t, tc]);

  const primaryDisabled =
    content.hasCountdown && remaining !== null && remaining > 0;

  async function handleResend() {
    const trimmed = emailValue.trim();
    if (!trimmed) {
      message.warning(t("emailRequiredWarning"));
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
        message.error(t("resendRateLimited"));
        return;
      }
      const failedReason = mapSupabaseErrorCode(error.code);
      message.error(
        t("resendFailed", {
          message: t(`${failedReason}.message` as Parameters<typeof t>[0]),
        }),
      );
      return;
    }
    message.success(t("resendSuccess"));
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
          {reasonTitle}
        </Title>
        <Paragraph style={{ marginBottom: 0 }}>{reasonMessage}</Paragraph>

        {content.showsEmailField && (
          <Form layout="vertical">
            <Form.Item label={t("emailLabel")} htmlFor="auth-error-email">
              <Input
                id="auth-error-email"
                type="email"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                placeholder={t("emailPlaceholder")}
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
            {reasonPrimaryLabel}
          </Button>
          {/* description §3: primary 1 + secondary <=1. "help" kind은 실제
              도움말 화면이 없어 misleading 이므로 secondary 버튼으로 렌더하지
              않는다 (대신 아래 정직한 escape-route 행으로 안내). */}
          {content.secondary && content.secondary.kind !== "help" && (
            <Link href={ctaHref(content.secondary.kind)} legacyBehavior>
              <Button type="link" block data-testid="auth-error-secondary">
                {t(`${reason}.secondaryLabel` as Parameters<typeof t>[0])}
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
              <Link href={link.href}>{t(link.labelKey)}</Link>
              {index < visible.length - 1 ? " · " : null}
            </span>
          ))}
        </Paragraph>
      </Space>
    </Card>
  );
}
