// Auth sign-out route handler (POST).
//
// APP_ROUTE_SPECS의 POST sign-out handler: 서버 사이드 세션 쿠키 정리.
//
// Flow:
//   1. POST /auth/sign-out (form action or fetch from client)
//   2. supabase.auth.signOut() clears the session server-side
//   3. cookieStore.set() invalidations land on the response via @supabase/ssr's
//      setAll callback (same pattern as /auth/callback Route Handler — Phase 8
//      P0 fix avoided the Server Component silent-fail trap)
//   4. Redirect to /login. If a sanitized `next` query exists, ignore it for
//      sign-out — always land on /login to make the new session boundary
//      obvious to the user.
//
// Security notes:
//   - POST-only (CSRF protection — GET would let third parties trigger logout
//     via link/img tags)
//   - No body required; Supabase signOut clears tokens by reading the current
//     session cookie
//   - dynamic: force-dynamic so middleware can't cache stale responses

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth/sign-out] signOut error", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
  }

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303, // See Other — POST → GET redirect
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", allow: ["POST"] },
    { status: 405, headers: { Allow: "POST" } },
  );
}
