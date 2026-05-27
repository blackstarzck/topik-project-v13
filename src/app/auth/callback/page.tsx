// Phase 8.5 · Auth callback page (server + client fragment fallback)
//
// Dispatches Supabase auth callbacks two ways:
//
// 1. Server-side (PKCE / token_hash query — main flow used by SignUpForm /
//    LoginForm via @supabase/ssr):
//      - token_hash + type → verifyOtp({ token_hash, type })
//      - code              → exchangeCodeForSession(code)
//    Success → redirect(next or /dashboard).
//    Failure → redirect('/auth/error?reason=<canonical>').
//
// 2. Client-side fragment fallback (implicit flow — old emails generated
//    before redirect_to was properly whitelisted, or any
//    /auth/v1/verify response that puts tokens/errors in the URL fragment):
//      - #error_code=... → /auth/error?reason=<mapped>
//      - #access_token + #refresh_token → setSession → router.replace(next)
//      - nothing       → /auth/error?reason=unknown
//
// Why both: server-side cannot read the fragment (it isn't sent in the
// HTTP request). We need a client component to catch implicit-flow links.
//
// Spec: docs/IA/33-X-11-auth-error/description.md
// Codex 3-round PASS: tasks/codex-output-auth-error-ux-round{1,2,3}-20260526.md

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CallbackFragmentFallback } from "@/components/auth/CallbackFragmentFallback";
import {
  mapSupabaseErrorCode,
  sanitizeNext,
} from "@/lib/auth/error-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type VerifyType = "signup" | "recovery" | "email_change" | "email";
const ALLOWED_VERIFY_TYPES = new Set<VerifyType>([
  "signup",
  "recovery",
  "email_change",
  "email",
]);

function isVerifyType(value: string | undefined): value is VerifyType {
  return value !== undefined && ALLOWED_VERIFY_TYPES.has(value as VerifyType);
}

function buildErrorPath(reason: string, retryAfterSeconds: number | null): string {
  const params = new URLSearchParams({ reason });
  if (retryAfterSeconds !== null) {
    params.set("retry_after_seconds", String(retryAfterSeconds));
  }
  return `/auth/error?${params.toString()}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(pickFirst(params.next));

  // Provider error already in query (some OAuth providers return error here).
  const errorCode = pickFirst(params.error_code);
  const errorDescription = pickFirst(params.error_description);
  if (errorCode) {
    console.error("[auth/callback] provider error in query", { errorCode, errorDescription });
    redirect(buildErrorPath(mapSupabaseErrorCode(errorCode), null));
  }

  const tokenHash = pickFirst(params.token_hash);
  const typeParam = pickFirst(params.type);
  const code = pickFirst(params.code);

  // Server-side path (PKCE / token_hash) — main flow.
  if (tokenHash && isVerifyType(typeParam)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam,
    });
    if (error) {
      console.error("[auth/callback] verifyOtp error", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      redirect(buildErrorPath(mapSupabaseErrorCode(error.code), null));
    }
    redirect(next);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      redirect(buildErrorPath(mapSupabaseErrorCode(error.code), null));
    }
    redirect(next);
  }

  // No server-readable token in query — could be implicit flow with fragment.
  // Render client component to parse window.location.hash and route accordingly.
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 640, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <CallbackFragmentFallback next={next} />
      </Suspense>
    </main>
  );
}
