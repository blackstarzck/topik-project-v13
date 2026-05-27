// Phase 8 follow-up P0 fix (2026-05-27):
//
// 직전 검수에서 발견: callback이 Server Component(page.tsx)일 때 verifyOtp는
// 성공하지만 `cookieStore.set(...)` 호출이 silent fail (src/lib/supabase/server.ts
// setAll의 try/catch 의도된 동작). 결과: 응답에 Set-Cookie 헤더 미포함 →
// /onboarding/learning-goal 도착 시 미인증 상태로 /login 튕김.
//
// 해결: callback을 Route Handler로 전환. Route Handler는 cookies().set 호출이
// 응답 헤더에 실제 emit됨. fragment fallback(implicit flow)은 HTML 렌더가 필요해
// 별도 page(/auth/callback-fragment)로 분리.
//
// 처리 분기:
//   1. token_hash + type (PKCE main flow) → verifyOtp → success: redirect(next) /
//      failure: redirect('/auth/error?reason=<mapped>')
//   2. code (OAuth-style) → exchangeCodeForSession → 동일 분기
//   3. error_code query (provider error) → redirect('/auth/error?reason=<mapped>')
//   4. 둘 다 없음 (implicit flow with #fragment) → redirect('/auth/callback-fragment')
//      → 브라우저가 fragment를 새 location에 자동 보존(RFC 7231) → client component 처리

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function isVerifyType(value: string | null): value is VerifyType {
  return value !== null && ALLOWED_VERIFY_TYPES.has(value as VerifyType);
}

function buildErrorUrl(
  request: NextRequest,
  reason: string,
  retryAfterSeconds: number | null,
): URL {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("reason", reason);
  if (retryAfterSeconds !== null) {
    url.searchParams.set("retry_after_seconds", String(retryAfterSeconds));
  }
  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = sanitizeNext(searchParams.get("next"));

  // 1. Provider error in query (some OAuth providers).
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  if (errorCode) {
    console.error("[auth/callback] provider error in query", {
      errorCode,
      errorDescription,
    });
    return NextResponse.redirect(
      buildErrorUrl(request, mapSupabaseErrorCode(errorCode), null),
    );
  }

  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const code = searchParams.get("code");

  // 2a. token_hash 있지만 type이 invalid — malformed callback. Codex 후속:
  // fragment fallback으로 흘리지 말고 명시적으로 /auth/error?reason=unknown.
  if (tokenHash && !isVerifyType(typeParam)) {
    console.error("[auth/callback] malformed callback: token_hash present but invalid type", {
      typeParam,
    });
    return NextResponse.redirect(buildErrorUrl(request, "unknown", null));
  }

  // 2. Server-side PKCE main flow.
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
      return NextResponse.redirect(
        buildErrorUrl(request, mapSupabaseErrorCode(error.code), null),
      );
    }
    // 세션 쿠키는 createSupabaseServerClient의 setAll callback이 cookies().set으로
    // 등록 → Route Handler 응답에 Set-Cookie 헤더 emit됨.
    return NextResponse.redirect(new URL(next, request.url));
  }

  // 3. OAuth code flow.
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      return NextResponse.redirect(
        buildErrorUrl(request, mapSupabaseErrorCode(error.code), null),
      );
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  // 4. No server-readable token — implicit flow with fragment.
  // RFC 7231: Location 헤더에 fragment 없으면 user agent가 원래 URL의 fragment를
  // 새 location에 retain. 따라서 우리가 query 없이 redirect하면 브라우저가 자동으로
  // #error_code=... 또는 #access_token=... 을 새 path에 붙여서 따라간다.
  // /auth/callback-fragment page가 client component로 window.location.hash 파싱.
  const fragmentTarget = new URL("/auth/callback-fragment", request.url);
  fragmentTarget.searchParams.set("next", next);
  return NextResponse.redirect(fragmentTarget);
}
