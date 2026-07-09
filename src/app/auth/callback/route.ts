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

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  mapSupabaseErrorCode,
  RATE_LIMIT_FALLBACK_SECONDS,
  sanitizeNext,
  type AuthErrorReason,
} from "@/lib/auth/error-mapping";
import { APP_ROUTES } from "@/lib/routes";
import { getPublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

// Codex P4 D8 (2026-05-29): Forward Supabase Retry-After to retry_after_seconds query.
//
// 한계: supabase-js v2 의 AuthError 는 response headers 를 노출 안 함 (status / code /
// message 만). 따라서 callback route 에서 진짜 Retry-After 헤더 값을 추출할 방법이
// 직접적으로는 없음. 정확한 forward 가 필요하면 createSupabaseServerClient 단계에서
// custom fetch (intercept fn) 를 끼워 response.headers.get("Retry-After") 를 capture
// 한 뒤 thread-local 비슷한 채널로 전달해야 함. 큰 변경이라 별도 PR.
//
// 현재 fix: rate-limit 계열 error code (`over_email_send_rate_limit`,
// `over_request_rate_limit`) 일 때 callback 에서 RATE_LIMIT_FALLBACK_SECONDS (60s)
// 를 명시 forward. 이전엔 항상 null 이라 X-11 AuthErrorCard 의 implicit default 가
// 받아주는 구조였음 — 의도가 호출자에서 explicit 해짐.
function rateLimitFallback(reason: AuthErrorReason): number | null {
  if (
    reason === "over_email_send_rate_limit" ||
    reason === "over_request_rate_limit"
  ) {
    return RATE_LIMIT_FALLBACK_SECONDS;
  }
  return null;
}

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

function resolveCallbackNext(
  rawNext: string | null,
  type: VerifyType | null,
): string {
  if (type === "recovery") return APP_ROUTES.passwordResetConfirm;
  return sanitizeNext(rawNext);
}

function buildBrowserVisibleAppUrl(path: string, request: NextRequest): URL {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") {
    url.hostname = "localhost";
  }
  return url;
}

function buildErrorUrl(
  request: NextRequest,
  reason: string,
  retryAfterSeconds: number | null,
): URL {
  const url = buildBrowserVisibleAppUrl("/auth/error", request);
  url.searchParams.set("reason", reason);
  if (retryAfterSeconds !== null) {
    url.searchParams.set("retry_after_seconds", String(retryAfterSeconds));
  }
  return url;
}

type ResponseCookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];

type CookieToSet = {
  name: string;
  value: string;
  options: ResponseCookieOptions;
};

function createAuthCallbackClient(request: NextRequest) {
  const env = getPublicEnv();
  const pendingCookies: CookieToSet[] = [];
  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(
          ...cookiesToSet.map(({ name, value, options }) => ({
            name,
            value,
            options: options as ResponseCookieOptions,
          })),
        );
      },
    },
  });

  return {
    supabase,
    withAuthCookies(response: NextResponse) {
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNext = searchParams.get("next");

  // 1. Provider error in query (some OAuth providers).
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  if (errorCode) {
    console.error("[auth/callback] provider error in query", {
      errorCode,
      errorDescription,
    });
    return NextResponse.redirect(
      buildErrorUrl(
        request,
        mapSupabaseErrorCode(errorCode),
        rateLimitFallback(mapSupabaseErrorCode(errorCode)),
      ),
    );
  }

  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const verifyType = isVerifyType(typeParam) ? typeParam : null;
  const code = searchParams.get("code");

  // 2a. token_hash 있지만 type이 invalid — malformed callback. Codex 후속:
  // fragment fallback으로 흘리지 말고 명시적으로 /auth/error?reason=unknown.
  if (tokenHash && !verifyType) {
    console.error(
      "[auth/callback] malformed callback: token_hash present but invalid type",
      {
        typeParam,
      },
    );
    return NextResponse.redirect(buildErrorUrl(request, "unknown", null));
  }

  // 2. Server-side PKCE main flow.
  if (tokenHash && verifyType) {
    const next = resolveCallbackNext(rawNext, verifyType);
    const { supabase, withAuthCookies } = createAuthCallbackClient(request);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: verifyType,
    });
    if (error) {
      console.error("[auth/callback] verifyOtp error", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      return withAuthCookies(
        NextResponse.redirect(
          buildErrorUrl(
            request,
            mapSupabaseErrorCode(error.code),
            rateLimitFallback(mapSupabaseErrorCode(error.code)),
          ),
        ),
      );
    }
    // 세션 쿠키는 createSupabaseServerClient의 setAll callback이 cookies().set으로
    // 등록 → Route Handler 응답에 Set-Cookie 헤더 emit됨.
    return withAuthCookies(
      NextResponse.redirect(buildBrowserVisibleAppUrl(next, request)),
    );
  }

  // 3. OAuth code flow.
  if (code) {
    const next = resolveCallbackNext(rawNext, verifyType);
    const { supabase, withAuthCookies } = createAuthCallbackClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();
      if (existingUser) {
        console.info(
          "[auth/callback] stale OAuth callback revisited with active session",
          {
            code: error.code,
            status: error.status,
          },
        );
        return withAuthCookies(
          NextResponse.redirect(buildBrowserVisibleAppUrl(next, request)),
        );
      }

      console.error("[auth/callback] exchangeCodeForSession error", {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      return withAuthCookies(
        NextResponse.redirect(
          buildErrorUrl(
            request,
            mapSupabaseErrorCode(error.code),
            rateLimitFallback(mapSupabaseErrorCode(error.code)),
          ),
        ),
      );
    }
    return withAuthCookies(
      NextResponse.redirect(buildBrowserVisibleAppUrl(next, request)),
    );
  }

  // 4. No server-readable token — implicit flow with fragment.
  // RFC 7231: Location 헤더에 fragment 없으면 user agent가 원래 URL의 fragment를
  // 새 location에 retain. 따라서 우리가 query 없이 redirect하면 브라우저가 자동으로
  // #error_code=... 또는 #access_token=... 을 새 path에 붙여서 따라간다.
  // /auth/callback-fragment page가 client component로 window.location.hash 파싱.
  const fragmentTarget = buildBrowserVisibleAppUrl(
    "/auth/callback-fragment",
    request,
  );
  const next = resolveCallbackNext(rawNext, verifyType);
  fragmentTarget.searchParams.set("next", next);
  return NextResponse.redirect(fragmentTarget);
}
