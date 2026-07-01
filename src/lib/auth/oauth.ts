"use client";

import { createSupabaseBrowserClient } from "../supabase/browser";

export type GoogleOAuthIntent = "login" | "sign-up";
export type GoogleOAuthEmbeddedBrowser =
  | "kakaoTalk"
  | "instagram"
  | "facebook"
  | "line"
  | "naver";

export type GoogleOAuthBrowserSupport =
  | { supported: true }
  | {
      supported: false;
      browser: GoogleOAuthEmbeddedBrowser;
      reason: "embedded_user_agent";
    };

const GOOGLE_OAUTH_DISALLOWED_USER_AGENTS: ReadonlyArray<{
  browser: GoogleOAuthEmbeddedBrowser;
  pattern: RegExp;
}> = [
  { browser: "kakaoTalk", pattern: /\bKAKAOTALK\b/i },
  { browser: "instagram", pattern: /\bInstagram\b/i },
  { browser: "facebook", pattern: /\b(FBAN|FBAV|FB_IAB)\b/i },
  { browser: "line", pattern: /\bLine\/\d/i },
  { browser: "naver", pattern: /\bNAVER\(inapp/i },
];

export class GoogleOAuthUnsupportedBrowserError extends Error {
  readonly browser: GoogleOAuthEmbeddedBrowser;

  constructor(browser: GoogleOAuthEmbeddedBrowser) {
    super("Google OAuth is blocked in this embedded browser.");
    this.name = "GoogleOAuthUnsupportedBrowserError";
    this.browser = browser;
  }
}

export function isGoogleOAuthUnsupportedBrowserError(
  error: unknown,
): error is GoogleOAuthUnsupportedBrowserError {
  return (
    error instanceof GoogleOAuthUnsupportedBrowserError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "GoogleOAuthUnsupportedBrowserError" &&
      "browser" in error)
  );
}

export function buildPostAuthPath(intent: GoogleOAuthIntent): string {
  return `/auth/post-auth?intent=${intent}`;
}

export function buildClaimAffiliationPath(nextPath: string): string {
  return buildInstitutionInvitePath(nextPath);
}

export function buildInstitutionInvitePath(nextPath: string): string {
  const params = new URLSearchParams({ next: ensureRelativePath(nextPath) });
  return `/auth/institution-invite?${params.toString()}`;
}

function buildOAuthNextPath(
  intent: GoogleOAuthIntent,
  nextPath?: string,
): string {
  const postAuthPath = nextPath
    ? ensureRelativePath(nextPath)
    : buildPostAuthPath(intent);
  return intent === "sign-up"
    ? buildClaimAffiliationPath(postAuthPath)
    : postAuthPath;
}

function ensureRelativePath(path: string): string {
  const next = path.startsWith("/") ? path : `/${path}`;
  if (next.startsWith("//") || next.includes(":")) {
    throw new Error(`OAuth callback next path must be relative, got: ${path}`);
  }
  return next;
}

function normalizeLocalBrowserOrigin(origin: string): string {
  const url = new URL(origin);
  if (url.hostname === "0.0.0.0") {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function buildClientAuthCallbackUrl(
  nextPath: string,
  origin = window.location.origin,
): string {
  const url = new URL("/auth/callback", normalizeLocalBrowserOrigin(origin));
  url.searchParams.set("next", ensureRelativePath(nextPath));
  return url.toString();
}

export function getGoogleOAuthBrowserSupport(
  userAgent =
    typeof navigator === "undefined" ? "" : navigator.userAgent,
): GoogleOAuthBrowserSupport {
  for (const disallowed of GOOGLE_OAUTH_DISALLOWED_USER_AGENTS) {
    if (disallowed.pattern.test(userAgent)) {
      return {
        supported: false,
        browser: disallowed.browser,
        reason: "embedded_user_agent",
      };
    }
  }
  return { supported: true };
}

export async function startGoogleOAuth(
  intent: GoogleOAuthIntent,
  nextPath?: string,
) {
  const browserSupport = getGoogleOAuthBrowserSupport();
  if (!browserSupport.supported) {
    throw new GoogleOAuthUnsupportedBrowserError(browserSupport.browser);
  }

  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildClientAuthCallbackUrl(buildOAuthNextPath(intent, nextPath)),
    },
  });
}
