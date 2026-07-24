// Inactive-account session-clear route handler (GET).
//
// Purpose: a withdrawn (`status='deleted'`) or `blocked` account may still
// carry a not-yet-expired access token. The workspace layout detects the
// inactive status and redirects here — but a Server Component cannot clear
// auth cookies, and if it redirected straight to /login the proxy would bounce
// the still-authenticated user back to /dashboard (auth-entry redirect),
// creating a loop. This route handler clears the local session cookies (route
// handlers CAN write cookies, same as /auth/sign-out) and then lands the user
// on /login with the matching notice reason.
//
// Flow:
//   1. Workspace layout detects an inactive profile and redirects here.
//   2. This handler verifies the JWT owner and reads that owner's minimal
//      account state through get_my_account_state(). Query parameters are
//      display hints only and are never trusted for authorization.
//   3. Only a verified blocked/deleted state may clear local auth cookies.
//   4. Active accounts return to /dashboard. Only a confirmed anonymous
//      request goes to /login; unknown/error states use the public auth-error
//      route so an authenticated cookie cannot bounce at an auth-entry page.
//   5. Until get_my_account_state() exists, only PGRST202 may fall back to the
//      same JWT/RLS client's own profiles row. Other RPC failures never do.
//
// GET (not POST) because it is reached via a layout redirect (navigation), not
// a form submission. Database-verified state prevents a forged cross-site GET
// from signing an active user out.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PUBLIC_RECOVERY_PATH = "/auth/error?reason=unknown";

type AccountState = "active" | "blocked" | "deleted";

function redirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), {
    status: 303,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isAccountState(value: unknown): value is AccountState {
  return value === "active" || value === "blocked" || value === "deleted";
}

async function readAccountState(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<AccountState | null> {
  const { data, error } = await supabase.rpc("get_my_account_state");
  if (!error) return isAccountState(data) ? data : null;
  if (error.code !== "PGRST202") return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", userId)
    .maybeSingle();

  if (
    profileError ||
    profile?.id !== userId ||
    !isAccountState(profile.status)
  ) {
    return null;
  }

  return profile.status;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      return redirect(request, PUBLIC_RECOVERY_PATH);
    }
    if (!user) {
      return redirect(request, "/login");
    }

    const accountState = await readAccountState(supabase, user.id);
    if (!accountState) {
      return redirect(request, PUBLIC_RECOVERY_PATH);
    }

    if (accountState === "active") {
      return redirect(request, "/dashboard");
    }

    try {
      // scope: 'local' clears the current device's session cookies without an
      // extra global revoke network call (deletion already revoked globally).
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        return redirect(request, PUBLIC_RECOVERY_PATH);
      }
    } catch {
      return redirect(request, PUBLIC_RECOVERY_PATH);
    }

    return redirect(
      request,
      `/login?reason=${accountState === "blocked" ? "blocked" : "withdrawn"}`,
    );
  } catch {
    return redirect(request, PUBLIC_RECOVERY_PATH);
  }
}
