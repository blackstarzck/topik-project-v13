"use client";

import { Alert, App, Button, Tag, Typography } from "antd";
import { LockKeyhole, Mail } from "@/components/shared/AppIcons";
import { useEffect, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import { buildAuthCallbackUrl } from "@/lib/auth/redirect-url";
import {
  buildClientAuthCallbackUrl,
  buildPostAuthPath,
} from "@/lib/auth/oauth";
import { mapSupabaseErrorCode } from "@/lib/auth/error-mapping";
import { APP_ROUTES } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DEFAULT_COOLDOWN_SECONDS,
  useEmailCooldown,
} from "@/lib/auth/use-email-cooldown";

const { Text } = Typography;
const PASSWORD_RESET_COOLDOWN_STORAGE_KEY =
  "talkpik:settings-password-reset:cooldown-until";

/** 멀티컬러 Google "G" 브랜드 로고. 브랜드 색은 SVG fill 속성으로 고정한다. */
function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type IdentityStatus = "loading" | "connected" | "disconnected" | "error";

export type AccountLoginMethodsLabels = {
  regionAriaLabel: string;
  emailMethod: string;
  emailUnavailable: string;
  googleMethod: string;
  googleDescription: string;
  passwordMethod: string;
  passwordDescription: string;
  passwordAction: string;
  passwordSent: string;
  passwordRateLimited: string;
  passwordSendFailed: string;
  connected: string;
  disconnected: string;
  connectGoogle: string;
  connectFailed: string;
  linkStarted: string;
};

function hasGoogleIdentity(identities: Array<{ provider?: string | null }>) {
  return identities.some((identity) => identity.provider === "google");
}

export function AccountLoginMethodsCard({
  accountEmail,
  labels,
}: {
  accountEmail: string | null;
  labels: AccountLoginMethodsLabels;
}) {
  const { message } = App.useApp();
  const [googleStatus, setGoogleStatus] = useState<IdentityStatus>("loading");
  const [linking, setLinking] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUserIdentities()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setGoogleStatus("error");
          return;
        }
        setGoogleStatus(
          hasGoogleIdentity(data?.identities ?? [])
            ? "connected"
            : "disconnected",
        );
      })
      .catch(() => {
        if (!cancelled) setGoogleStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLinkGoogle() {
    setErrorVisible(false);
    setLinking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: buildClientAuthCallbackUrl(
            buildPostAuthPath("link-google"),
          ),
        },
      });
      if (error) {
        setErrorVisible(true);
        return;
      }
      setGoogleStatus("connected");
      message.success(labels.linkStarted);
    } catch {
      setErrorVisible(true);
    } finally {
      setLinking(false);
    }
  }

  const googleConnected = googleStatus === "connected";

  return (
    <section
      role="region"
      aria-label={labels.regionAriaLabel}
      className="app-cards-bordered"
    >
      <div className="account-login-methods">
        <AppCard className="account-login-method">
          <span className="account-login-method-icon">
            <Mail aria-hidden size={20} strokeWidth={1.75} />
          </span>
          <span className="account-login-method-copy">
            <Text strong>{labels.emailMethod}</Text>
            <Text type="secondary">
              {accountEmail ?? labels.emailUnavailable}
            </Text>
          </span>
          <span className="account-login-method-status">
            <Tag color="success">{labels.connected}</Tag>
          </span>
        </AppCard>

        <PasswordChangeMethodCard accountEmail={accountEmail} labels={labels} />

        <AppCard className="account-login-method">
          <span className="account-login-method-icon">
            <GoogleGlyph />
          </span>
          <span className="account-login-method-copy">
            <Text strong>{labels.googleMethod}</Text>
            <Text type="secondary">{labels.googleDescription}</Text>
          </span>
          <span className="account-login-method-status">
            <Tag color={googleConnected ? "success" : "default"}>
              {googleConnected ? labels.connected : labels.disconnected}
            </Tag>
            {!googleConnected ? (
              <Button
                size="small"
                loading={linking}
                disabled={googleStatus === "loading"}
                onClick={handleLinkGoogle}
              >
                {labels.connectGoogle}
              </Button>
            ) : null}
          </span>
        </AppCard>
      </div>

      {errorVisible || googleStatus === "error" ? (
        <Alert
          type="error"
          showIcon
          title={labels.connectFailed}
          className="account-login-error"
        />
      ) : null}
    </section>
  );
}

function PasswordChangeMethodCard({
  accountEmail,
  labels,
}: {
  accountEmail: string | null;
  labels: AccountLoginMethodsLabels;
}) {
  const { message } = App.useApp();
  const [passwordSending, setPasswordSending] = useState(false);
  const passwordCooldown = useEmailCooldown(
    PASSWORD_RESET_COOLDOWN_STORAGE_KEY,
    DEFAULT_COOLDOWN_SECONDS,
  );

  async function handleSendPasswordReset() {
    if (!accountEmail || passwordSending || passwordCooldown.remaining > 0) {
      return;
    }

    setPasswordSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        accountEmail,
        {
          redirectTo: buildAuthCallbackUrl(APP_ROUTES.passwordResetConfirm),
        },
      );
      if (error) {
        const code = mapSupabaseErrorCode(error.code);
        const status =
          "status" in error && typeof error.status === "number"
            ? error.status
            : null;

        if (code === "user_not_found") {
          passwordCooldown.start();
          message.success(labels.passwordSent);
          return;
        }
        if (
          code === "over_email_send_rate_limit" ||
          code === "over_request_rate_limit" ||
          status === 429
        ) {
          passwordCooldown.start();
          message.error(labels.passwordRateLimited);
          return;
        }
        message.error(labels.passwordSendFailed);
        return;
      }

      passwordCooldown.start();
      message.success(labels.passwordSent);
    } catch {
      message.error(labels.passwordSendFailed);
    } finally {
      setPasswordSending(false);
    }
  }

  const passwordActionLabel =
    passwordCooldown.remaining > 0
      ? `${labels.passwordAction} (${passwordCooldown.remaining})`
      : labels.passwordAction;

  return (
    <AppCard className="account-login-method account-password-change-card">
      <span className="account-login-method-icon">
        <LockKeyhole aria-hidden size={20} strokeWidth={1.75} />
      </span>
      <span className="account-login-method-copy">
        <Text strong>{labels.passwordMethod}</Text>
        <Text type="secondary">{labels.passwordDescription}</Text>
      </span>
      <span className="account-login-method-status">
        <Button
          size="small"
          loading={passwordSending}
          disabled={
            !accountEmail || passwordSending || passwordCooldown.remaining > 0
          }
          onClick={handleSendPasswordReset}
          data-testid="account-password-reset-send"
        >
          {passwordActionLabel}
        </Button>
      </span>
    </AppCard>
  );
}

export function AccountPasswordChangeCard({
  accountEmail,
  labels,
}: {
  accountEmail: string | null;
  labels: AccountLoginMethodsLabels;
}) {
  return (
    <section
      role="region"
      aria-label={labels.passwordMethod}
      className="app-cards-bordered"
    >
      <PasswordChangeMethodCard accountEmail={accountEmail} labels={labels} />
    </section>
  );
}
