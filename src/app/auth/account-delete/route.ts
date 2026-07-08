import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  deleteTalkpikAccountProfile,
  getTalkpikApiBaseUrl,
} from "@/lib/talkpik-api/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function requestProto(request: NextRequest): string {
  return (
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    new URL(request.url).protocol.replace(":", "")
  );
}

function requestPublicOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // Fall through to host-based origin construction.
    }
  }

  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    firstHeaderValue(request.headers.get("host"));
  if (host) {
    return `${requestProto(request)}://${host}`;
  }

  return new URL(request.url).origin;
}

function redirectUrl(request: NextRequest, path: string) {
  return new URL(path, requestPublicOrigin(request));
}

function isSameOriginPost(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const expectedOrigins = new Set([new URL(request.url).origin]);
    const forwardedProto = requestProto(request);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = request.headers.get("host");

    for (const candidateHost of [forwardedHost, host]) {
      const firstHost = firstHeaderValue(candidateHost);
      if (firstHost) {
        expectedOrigins.add(`${forwardedProto}://${firstHost}`);
      }
    }

    return expectedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function redirectToDeleteError(request: NextRequest) {
  return NextResponse.redirect(
    redirectUrl(request, "/settings/account?delete=error"),
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

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(redirectUrl(request, "/login"), {
      status: 303,
    });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    console.error("[auth/account-delete] missing session access token");
    return redirectToDeleteError(request);
  }

  let baseUrl: string | null = null;
  try {
    baseUrl = getTalkpikApiBaseUrl();
  } catch (error) {
    console.error("[auth/account-delete] external api base URL error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return redirectToDeleteError(request);
  }

  if (!baseUrl) {
    console.error("[auth/account-delete] external api base URL missing");
    return redirectToDeleteError(request);
  }

  try {
    await deleteTalkpikAccountProfile({ baseUrl, accessToken });
  } catch (error) {
    const status = errorStatus(error);
    if (status !== 404) {
      console.error("[auth/account-delete] external account deletion error", {
        message: error instanceof Error ? error.message : "unknown",
        status,
      });
      return redirectToDeleteError(request);
    }
  }

  const { error: rpcError } = await supabase.rpc("request_account_deletion");
  if (rpcError) {
    console.error("[auth/account-delete] rpc error", {
      code: rpcError.code,
      message: rpcError.message,
    });
    return redirectToDeleteError(request);
  }

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "global",
  });
  if (signOutError) {
    console.error("[auth/account-delete] signOut error", {
      code: signOutError.code,
      message: signOutError.message,
      status: signOutError.status,
    });
  }

  return NextResponse.redirect(
    redirectUrl(request, "/login?reason=withdrawn"),
    { status: 303 },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", allow: ["POST"] },
    { status: 405, headers: { Allow: "POST" } },
  );
}
