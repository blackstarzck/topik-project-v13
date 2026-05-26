import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { PUBLIC_PATHS } from "./lib/routes";
import { getPublicEnv } from "./lib/supabase/env";
import type { Database } from "./lib/supabase/types";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!isPublicPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Phase 8-D: 만료된 Supabase 세션 쿠키가 붙어왔다면 session_expired reason 전달
    // (사용자가 LoginForm 안내 Alert을 보게 됨). 처음부터 익명이면 reason 없이.
    const hadStaleSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
    url.search = hadStaleSession ? "?reason=session_expired" : "";
    const redirectResponse = NextResponse.redirect(url);
    // Carry over cookies that supabase.auth.getUser() may have refreshed
    // or cleared. Without this, an expired refresh cookie would survive
    // the redirect and the next request would hit refresh failure again.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Run on every request except api routes, the Next runtime, the favicon,
  // and any static asset (images, fonts, sitemap, robots, etc). The asset
  // exclusion prevents `/icon.svg`, `/robots.txt`, `/sitemap.xml`, and
  // similar metadata files from being redirected to /login.
  //
  // `/paywall` and `/subscription` shells stay behind the auth gate by
  // default and will be revisited when billing scope is reopened.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|ttf|otf)$).*)",
  ],
};
