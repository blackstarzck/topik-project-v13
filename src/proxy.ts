import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthEntryRedirectPath } from "./lib/auth/completion-routes";
import { APP_ROUTES, AUTH_ENTRY_PATHS, PUBLIC_PATHS } from "./lib/routes";
import { getPublicEnv } from "./lib/supabase/env";
import type { Database } from "./lib/supabase/types";

const AFFILIATION_CODE_PARAM = "aff";
const INSTITUTION_INVITE_PATH = "/auth/institution-invite";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.some((p) => pathname === p);
}

function redirectWithRefreshedCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}

function isSafeRelativePath(path: string | null): path is string {
  return Boolean(
    path &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes(":"),
  );
}

function isInstitutionInviteNext(path: string | null): path is string {
  return (
    isSafeRelativePath(path) &&
    (path === INSTITUTION_INVITE_PATH ||
      path.startsWith(`${INSTITUTION_INVITE_PATH}?`))
  );
}

function buildInstitutionInviteRedirectUrl(request: NextRequest) {
  const aff = request.nextUrl.searchParams.get(AFFILIATION_CODE_PARAM);
  const next = request.nextUrl.searchParams.get("next");
  const url = request.nextUrl.clone();

  if (isInstitutionInviteNext(next)) {
    const inviteUrl = new URL(next, request.url);
    if (aff) {
      inviteUrl.searchParams.set(AFFILIATION_CODE_PARAM, aff);
    }
    return inviteUrl;
  }

  url.pathname = INSTITUTION_INVITE_PATH;
  url.search = "";
  if (aff) {
    url.searchParams.set(AFFILIATION_CODE_PARAM, aff);
  }
  if (isSafeRelativePath(next)) {
    url.searchParams.set("next", next);
  }
  return url;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // The callback route must read the original PKCE verifier cookie before any
  // session refresh can mutate the request cookies.
  if (pathname === APP_ROUTES.authCallback) {
    return NextResponse.next({ request });
  }

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

  if (
    user &&
    isAuthEntryPath(pathname) &&
    (request.nextUrl.searchParams.has(AFFILIATION_CODE_PARAM) ||
      isInstitutionInviteNext(request.nextUrl.searchParams.get("next")))
  ) {
    return redirectWithRefreshedCookies(
      buildInstitutionInviteRedirectUrl(request),
      response,
    );
  }

  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone();
    const redirectPath = getAuthEntryRedirectPath(pathname);
    url.pathname = redirectPath.split("?")[0];
    url.search = redirectPath.includes("?")
      ? `?${redirectPath.split("?")[1]}`
      : "";
    return redirectWithRefreshedCookies(url, response);
  }

  if (!isPublicPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Phase 8-D: 만료된 Supabase 세션 쿠키가 붙어왔다면 session_expired reason 전달
    // (사용자가 LoginForm 안내 Alert을 보게 됨). 처음부터 익명이면 reason 없이.
    const hadStaleSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
    url.search = hadStaleSession ? "?reason=session_expired" : "";
    // Carry over cookies that supabase.auth.getUser() may have refreshed
    // or cleared. Without this, an expired refresh cookie would survive
    // the redirect and the next request would hit refresh failure again.
    return redirectWithRefreshedCookies(url, response);
  }

  return response;
}

export const config = {
  // Run on every request except api routes, the Next runtime, the favicon,
  // and any static asset (images, videos, fonts, sitemap, robots, etc). The asset
  // exclusion prevents `/icon.png`, `/robots.txt`, `/sitemap.xml`, and
  // similar metadata files from being redirected to /login.
  //
  // `/paywall` and `/subscription` shells stay behind the auth gate by
  // default and will be revisited when billing scope is reopened.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico|txt|xml|woff2?|ttf|otf)$).*)",
  ],
};
