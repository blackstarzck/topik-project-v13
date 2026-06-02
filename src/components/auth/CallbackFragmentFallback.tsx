"use client";

// Phase 8.5 · Client-side fragment fallback for /auth/callback
//
// Server side of the callback can only see URL query params. Supabase's
// older /auth/v1/verify response (implicit flow, or any old confirmation
// email whose redirect_to was set to a non-callback URL) puts tokens and
// errors in the URL fragment (#access_token=..., #error_code=...).
//
// This client component runs once on mount:
//   - #error_code in fragment → map to canonical reason, redirect to
//     /auth/error?reason=<...>
//   - #access_token + #refresh_token → supabase.auth.setSession, redirect to
//     `next`
//   - neither → /auth/error?reason=unknown
//
// While running, shows a small spinner so the page isn't blank for the
// 50-200ms it takes to parse and redirect.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, Spin, Typography } from "antd";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  mapSupabaseErrorCode,
  parseAuthFragment,
} from "@/lib/auth/error-mapping";

const { Paragraph } = Typography;

export function CallbackFragmentFallback({ next }: { next: string }) {
  const t = useTranslations("auth.callback");
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "redirecting">("checking");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const parsed = parseAuthFragment(hash);

      if (parsed.errorCode) {
        const reason = mapSupabaseErrorCode(parsed.errorCode);
        if (!cancelled) {
          setStatus("redirecting");
          router.replace(`/auth/error?reason=${encodeURIComponent(reason)}`);
        }
        return;
      }

      if (parsed.accessToken && parsed.refreshToken) {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (cancelled) return;
        if (error) {
          console.error("[auth/callback/fragment] setSession error", error);
          setStatus("redirecting");
          router.replace(
            `/auth/error?reason=${encodeURIComponent(mapSupabaseErrorCode(error.code))}`,
          );
          return;
        }
        setStatus("redirecting");
        router.replace(next);
        return;
      }

      if (!cancelled) {
        setStatus("redirecting");
        router.replace("/auth/error?reason=unknown");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  return (
    <Card
      style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}
      role="status"
      aria-live="polite"
      data-testid="callback-fragment-status"
    >
      <Spin />
      <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
        {status === "checking" ? t("checking") : t("redirecting")}
      </Paragraph>
    </Card>
  );
}
