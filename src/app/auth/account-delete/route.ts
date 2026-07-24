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

function normalizeHttpOrigin(value: string | undefined): string | null {
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

function trustedRequestOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>();
  const configured = configuredSiteOrigin();
  if (configured) origins.add(configured);

  if (process.env.NODE_ENV !== "production") {
    const requestOrigin = normalizeHttpOrigin(request.url);
    if (requestOrigin && isLoopbackOrigin(requestOrigin)) {
      origins.add(requestOrigin);
    }
  }

  return origins;
}

function redirectUrl(request: NextRequest, path: string) {
  const configured = configuredSiteOrigin();
  const requestOrigin = normalizeHttpOrigin(request.url);
  const baseOrigin =
    configured ??
    (process.env.NODE_ENV !== "production" &&
    requestOrigin &&
    isLoopbackOrigin(requestOrigin)
      ? requestOrigin
      : null);

  if (!baseOrigin) {
    throw new Error("Trusted site origin is not configured");
  }
  return new URL(path, baseOrigin);
}

function isSameOriginPost(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;

  try {
    return trustedRequestOrigins(request).has(new URL(origin).origin);
  } catch {
    return false;
  }
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
