"use client";

import { Alert, App, Button, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

import { AppCard } from "@/components/shared/AppCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const { Paragraph, Text } = Typography;

type IdentityStatus = "loading" | "connected" | "disconnected" | "error";

export type AccountLoginMethodsLabels = {
  regionAriaLabel: string;
  title: string;
  description: string;
  emailMethod: string;
  emailUnavailable: string;
  googleMethod: string;
  googleDescription: string;
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
      const { error } = await supabase.auth.linkIdentity({ provider: "google" });
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
    <AppCard
      size="small"
      role="region"
      aria-label={labels.regionAriaLabel}
      className="mb-4"
    >
      <div className="grid gap-4">
        <div>
          <Paragraph strong className="!mb-1 !mt-0">
            {labels.title}
          </Paragraph>
          <Paragraph type="secondary" className="!mb-0">
            {labels.description}
          </Paragraph>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-default border border-border p-3">
            <span className="grid gap-1">
              <Text strong>{labels.emailMethod}</Text>
              <Text type="secondary">
                {accountEmail ?? labels.emailUnavailable}
              </Text>
            </span>
            <Tag color="success">{labels.connected}</Tag>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-default border border-border p-3">
            <span className="grid gap-1">
              <Text strong>{labels.googleMethod}</Text>
              <Text type="secondary">{labels.googleDescription}</Text>
            </span>
            <span className="flex items-center gap-2">
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
          </div>
        </div>

        {errorVisible || googleStatus === "error" ? (
          <Alert type="error" showIcon title={labels.connectFailed} />
        ) : null}
      </div>
    </AppCard>
  );
}
