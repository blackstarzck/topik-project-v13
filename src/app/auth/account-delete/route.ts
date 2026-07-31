import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  deleteTalkpikAccountProfile,
  getTalkpikApiBaseUrl,
} from "@/lib/talkpik-api/account";
import {
  ACCOUNT_DELETION_CONFIRMATION_FIELD,
  isValidAccountDeletionConfirmation,
} from "@/lib/auth/account-deletion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function normalizeHttpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function configuredSiteOrigin(): string | null {
  return normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL);
}

/**
 * The authority the browser actually addressed, parsed from `Host`.
 *
 * `x-forwarded-*` is deliberately not consulted, so a forwarded header can
 * never widen what this route accepts.
 */
function addressedAuthority(request: NextRequest): URL | null {
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!host) return null;

  try {
    const url = new URL(`http://${host}`);
    // Only a bare authority may pass. A value carrying a path, query or
    // userinfo is not a `Host` and must not be read as one — otherwise
    // `127.0.0.1:3001/@evil.example` would parse as a loopback authority.
    return url.host === host ? url : null;
  } catch {
    return null;
  }
}

/**
 * The browser-addressed origin, trusted outside production only, and only for a
 * loopback authority.
 *
 * `request.url` must NOT be used here: the Next server pins its hostname to the
 * server's own origin and ignores `Host` (verified on Next 16.2.6 — a probe
 * with `Host: app.example.com` still reported `https://localhost:3001/...`, and
 * only the protocol tracked `x-forwarded-proto`). A dev server on :3001
 * therefore trusted `http://localhost:3001` no matter which host the browser
 * addressed, so a browser at `http://127.0.0.1:3001` was refused its own
 * account deletion. `Origin` supplies the scheme and `Host` proves the
 * authority the browser addressed.
 */
function loopbackBrowserOrigin(request: NextRequest): string | null {
  if (process.env.NODE_ENV === "production") return null;

  const addressed = addressedAuthority(request);
  if (!addressed || !isLoopbackOrigin(addressed.origin)) return null;

  const origin = normalizeHttpOrigin(request.headers.get("origin"));
  if (!origin) return null;

  // Hosts are compared, not origins: `Host` carries no scheme. A scheme change
  // is a different origin, which the `Origin` allowlist above still governs in
  // production; here the pairing only has to prove the browser addressed
  // exactly this loopback authority.
  return new URL(origin).host === addressed.host ? origin : null;
}

/**
 * `NEXT_PUBLIC_SITE_URL` stays the authoritative allowlist: in production it is
 * the only accepted origin. Outside production the loopback fallback also
 * accepts the loopback authority the browser actually addressed, so a dev
 * server reached on a different loopback host or port than the configured one
 * still works.
 */
function isTrustedBrowserOrigin(request: NextRequest, origin: string): boolean {
  return (
    origin === configuredSiteOrigin() ||
    origin === loopbackBrowserOrigin(request)
  );
}

/**
 * Redirects are built on the origin the browser is actually on, so a dev server
 * that booted on :3001 does not complete the deletion and then bounce the
 * browser to a dead :3000. A dev port is assigned at boot — parallel worktrees
 * each land on a different one — so no static `NEXT_PUBLIC_SITE_URL` can track
 * it.
 *
 * Production is unaffected: `loopbackBrowserOrigin` is null there, leaving
 * `NEXT_PUBLIC_SITE_URL` as the only possible base, so a rewritten `Host` can
 * never redirect the browser elsewhere. Every caller runs after
 * `isSameOriginPost`, so any origin reached here is already proven trusted.
 */
function redirectUrl(request: NextRequest, path: string) {
  const baseOrigin = loopbackBrowserOrigin(request) ?? configuredSiteOrigin();

  if (!baseOrigin) {
    throw new Error("Trusted site origin is not configured");
  }
  return new URL(path, baseOrigin);
}

function isSameOriginPost(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return false;

  // Rejects an absent, opaque (`null`) or non-http(s) `Origin` before any
  // comparison.
  const origin = normalizeHttpOrigin(request.headers.get("origin"));
  if (!origin) return false;

  return isTrustedBrowserOrigin(request, origin);
}

function redirectToDeleteError(request: NextRequest) {
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.redirect(
    redirectUrl(request, "/settings/account?delete=error"),
    { status: 303 },
  );
}

function accountDeletionSucceeded(request: NextRequest) {
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(
    redirectUrl(request, "/login?reason=withdrawn"),
    { status: 303 },
  );
}

function errorStatus(error: unknown): number | undefined {
  if (
    error != null &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

function logAccountDeletionFailure(
  stage:
    | "external_configuration"
    | "external_profile"
    | "local_account"
    | "session"
    | "session_cleanup",
) {
  console.error("account_delete_failed", { stage });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let confirmation: FormDataEntryValue | null;
  try {
    const formData = await request.formData();
    confirmation = formData.get(ACCOUNT_DELETION_CONFIRMATION_FIELD);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!isValidAccountDeletionConfirmation(confirmation)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    return NextResponse.redirect(redirectUrl(request, "/login"), {
      status: 303,
    });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    logAccountDeletionFailure("session");
    return redirectToDeleteError(request);
  }

  let baseUrl: string | null = null;
  try {
    baseUrl = getTalkpikApiBaseUrl();
  } catch {
    logAccountDeletionFailure("external_configuration");
    return redirectToDeleteError(request);
  }

  if (!baseUrl) {
    logAccountDeletionFailure("external_configuration");
    return redirectToDeleteError(request);
  }

  try {
    await deleteTalkpikAccountProfile({ baseUrl, accessToken });
  } catch (error) {
    const status = errorStatus(error);
    if (status !== 404) {
      logAccountDeletionFailure("external_profile");
      return redirectToDeleteError(request);
    }
  }

  const { error: rpcError } = await supabase.rpc("request_account_deletion");
  if (rpcError) {
    logAccountDeletionFailure("local_account");
    return redirectToDeleteError(request);
  }

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "global",
  });
  if (signOutError) {
    logAccountDeletionFailure("session_cleanup");
  }

  return accountDeletionSucceeded(request);
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", allow: ["POST"] },
    { status: 405, headers: { Allow: "POST" } },
  );
}
