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
//   1. Workspace layout: status !== 'active' → redirect /auth/account-inactive?status=<status>
//   2. supabase.auth.signOut({ scope: 'local' }) clears this device's cookies
//      (refresh tokens were already revoked globally at deletion time).
//   3. Redirect 303 to /login?reason=withdrawn (deleted) | blocked.
//
// GET (not POST) because it is reached via a layout redirect (navigation), not
// a form submission. It performs no destructive server mutation — only local
// cookie clearing — so CSRF concerns do not apply.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const reason = status === "blocked" ? "blocked" : "withdrawn";

  const supabase = await createSupabaseServerClient();
  // scope: 'local' clears the current device's session cookies without an
  // extra global revoke network call (deletion already revoked globally).
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    console.error("auth_inactive_session_clear_failed", {
      stage: "local_sign_out",
    });
  }

  return NextResponse.redirect(
    new URL(`/login?reason=${reason}`, request.url),
    {
      status: 303,
    },
  );
}
