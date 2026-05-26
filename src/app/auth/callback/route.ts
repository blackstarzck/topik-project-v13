// Phase 8-C · Auth callback Route Handler
//
// Dispatches Supabase auth callbacks:
//   - token_hash + type → verifyOtp({ token_hash, type })
//     types: 'signup' | 'recovery' | 'email_change' | 'email' (PKCE magic link)
//   - code → exchangeCodeForSession(code) (PKCE)
//
// Success → redirect to sanitized `next` (relative-only) or /dashboard.
// Failure → redirect to /auth/error?reason=<canonical>&retry_after_seconds=<n?>.
// raw error_description is logged server-side only.
//
// Spec: docs/IA/33-X-11-auth-error/description.md, docs/sitemap.md (X-11/X-12 rows).
// Codex 3-round PASS: tasks/codex-output-auth-error-ux-round{1,2,3}-20260526.md.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapSupabaseErrorCode,
  sanitizeNext,
  sanitizeRetryAfterSeconds,
} from "@/lib/auth/error-mapping";

export const dynamic = "force-dynamic";

const ALLOWED_VERIFY_TYPES = new Set([
  "signup",
  "recovery",
  "email_change",
  "email",
] as const);

type VerifyType = "signup" | "recovery" | "email_change" | "email";

function isVerifyType(value: string | null): value is VerifyType {
  return value !== null && ALLOWED_VERIFY_TYPES.has(value as VerifyType);
}

function buildErrorRedirect(
  request: NextRequest,
  reason: string,
  retryAfterSeconds: number | null,
): NextResponse {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("reason", reason);
  if (retryAfterSeconds !== null) {
    url.searchParams.set("retry_after_seconds", String(retryAfterSeconds));
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeNext(searchParams.get("next"));

  // Pre-check: provider error in query (OAuth fragment style fallback)
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  if (errorCode) {
    console.error("[auth/callback] provider error", { errorCode, errorDescription });
    return buildErrorRedirect(request, mapSupabaseErrorCode(errorCode), null);
  }

  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createSupabaseServerClient();

  try {
    if (tokenHash && isVerifyType(typeParam)) {
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
        return buildErrorRedirect(
          request,
          mapSupabaseErrorCode(error.code),
          sanitizeRetryAfterSeconds(error.status === 429 ? "60" : null),
        );
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchangeCodeForSession error", {
          code: error.code,
          message: error.message,
          status: error.status,
        });
        return buildErrorRedirect(
          request,
          mapSupabaseErrorCode(error.code),
          sanitizeRetryAfterSeconds(error.status === 429 ? "60" : null),
        );
      }
    } else {
      console.error("[auth/callback] missing token_hash/type or code", {
        hasTokenHash: !!tokenHash,
        typeParam,
        hasCode: !!code,
      });
      return buildErrorRedirect(request, "unknown", null);
    }
  } catch (err) {
    console.error("[auth/callback] unexpected error", err);
    return buildErrorRedirect(request, "unknown", null);
  }

  return NextResponse.redirect(new URL(next, origin));
}
