"use client";

import { createSupabaseBrowserClient } from "../supabase/browser";

export type GoogleOAuthIntent = "login" | "sign-up";

export function buildPostAuthPath(intent: GoogleOAuthIntent): string {
  return `/auth/post-auth?intent=${intent}`;
}

function ensureRelativePath(path: string): string {
  const next = path.startsWith("/") ? path : `/${path}`;
  if (next.startsWith("//") || next.includes(":")) {
    throw new Error(`OAuth callback next path must be relative, got: ${path}`);
  }
  return next;
}

export function buildClientAuthCallbackUrl(
  nextPath: string,
  origin = window.location.origin,
): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", ensureRelativePath(nextPath));
  return url.toString();
}

export async function startGoogleOAuth(intent: GoogleOAuthIntent) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildClientAuthCallbackUrl(buildPostAuthPath(intent)),
    },
  });
}
