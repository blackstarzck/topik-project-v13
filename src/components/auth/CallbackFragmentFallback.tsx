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

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Spin, Typography } from "antd";

import { AppCard } from "@/components/shared/AppCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  mapSupabaseErrorCode,
  parseAuthFragment,
} from "@/lib/auth/error-mapping";
import { APP_ROUTES } from "@/lib/routes";

const { Paragraph } = Typography;
const UNKNOWN_AUTH_ERROR_PATH = "/auth/error?reason=unknown";

async function processFragment(next: string): Promise<string | null> {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const cleanLocation =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "";

  if (hash) {
    try {
      window.history.replaceState(window.history.state, "", cleanLocation);
    } catch {
      try {
        window.location.replace(cleanLocation);
      } catch {
        // Navigation may throw in constrained browser environments. The
        // fragment must still never be parsed, logged, or exchanged here.
      }
      return null;
    }
  }

  try {
    const parsed = parseAuthFragment(hash);

    if (parsed.errorCode) {
      const reason = mapSupabaseErrorCode(parsed.errorCode);
      return `/auth/error?reason=${encodeURIComponent(reason)}`;
    }

    if (parsed.accessToken && parsed.refreshToken) {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (error) {
        return `/auth/error?reason=${encodeURIComponent(
          mapSupabaseErrorCode(error.code),
        )}`;
      }
      return parsed.type === "recovery"
        ? APP_ROUTES.passwordResetConfirm
        : next;
    }

    return UNKNOWN_AUTH_ERROR_PATH;
  } catch {
    return UNKNOWN_AUTH_ERROR_PATH;
  }
}

export function CallbackFragmentFallback({ next }: { next: string }) {
  const t = useTranslations("auth.callback");
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "redirecting">("checking");
  const processingRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    processingRef.current ??= processFragment(next);

    const navigate = (destination: string | null) => {
      if (cancelled || !destination) return;
      setStatus("redirecting");
      try {
        router.replace(destination);
      } catch {
        try {
          window.location.replace(UNKNOWN_AUTH_ERROR_PATH);
        } catch {
          // Keep navigation failures contained; never surface fragment data.
        }
      }
    };

    void processingRef.current
      .then(navigate, () => {
        navigate(UNKNOWN_AUTH_ERROR_PATH);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [next, router]);

  return (
    <AppCard
      className="text-center"
      role="status"
      aria-live="polite"
      data-testid="callback-fragment-status"
    >
      <Spin />
      <Paragraph className="mb-0 mt-4">
        {status === "checking" ? t("checking") : t("redirecting")}
      </Paragraph>
    </AppCard>
  );
}
