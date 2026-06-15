// Marketing unsubscribe route (H-2 / N-EML-07).
//
// ARCHITECTURE / AUTH MODEL (decided):
//   This link is clicked from a marketing EMAIL, so there is NO user session.
//   The `unsubscribe_token` (a uuid stored in public.user_marketing_consent) is
//   the authentication: possession of the token authorizes unsubscribing that
//   one row. We use a service-role client (RLS bypass, server-only) and look up
//   STRICTLY by token. We never accept a user_id and never expose other users'
//   data — the response only confirms the action, nothing about the account.
//
//   GET  = link click from the email (browser navigation) → HTML confirmation.
//   POST = programmatic / form submit → JSON confirmation.
//
//   Idempotent: already-unsubscribed token → still 200 ("이미 수신거부됨").
//   Missing / malformed / unknown token → 400 (no row mutated, no info leak).
//
// runtime=nodejs: uses the service-role key; must never run on the edge or be
// importable by client code (server-only route).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// user_marketing_consent 는 v13 마이그레이션(20260612200000)이 만든 테이블이지만
// 생성된 Database 타입에 아직 없을 수 있으므로, 이 라우트가 접근하는 컬럼만 최소
// 스키마로 선언해 service-role 클라이언트를 타입 안전하게 사용한다.
type UnsubscribeSchema = {
  public: {
    Tables: {
      user_marketing_consent: {
        Row: {
          user_id: string;
          unsubscribe_token: string;
          consented_at: string | null;
          unsubscribed_at: string | null;
        };
        Insert: never;
        Update: { unsubscribed_at?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// rfc4122 uuid 형식 검사. 토큰이 uuid가 아니면 DB 조회 전에 400으로 단락.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UnsubscribeOutcome =
  | { kind: "unsubscribed" }
  | { kind: "already" }
  | { kind: "invalid_token" }
  | { kind: "misconfigured" }
  | { kind: "error" };

function htmlPage(title: string, message: string, status: number) {
  const body = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #222;">
<h1 style="font-size: 1.25rem;">${title}</h1>
<p style="color: #555;">${message}</p>
</body></html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function processUnsubscribe(token: string | null): Promise<UnsubscribeOutcome> {
  // 1. 토큰 형식 검사 — 없거나 uuid가 아니면 즉시 invalid.
  if (!token || !UUID_RE.test(token)) {
    return { kind: "invalid_token" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { kind: "misconfigured" };
  }

  // 2. service-role 클라이언트 (세션 없음, RLS 우회 — 토큰이 인증).
  const supabase: SupabaseClient<UnsubscribeSchema, "public"> = createClient<
    UnsubscribeSchema,
    "public"
  >(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 3. 토큰으로만 조회. user_id는 받지도, 노출하지도 않는다.
  const { data: row, error: selectError } = await supabase
    .from("user_marketing_consent")
    .select("user_id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (selectError) {
    console.error("[unsubscribe] lookup failed", selectError.message);
    return { kind: "error" };
  }
  if (!row) {
    // 알 수 없는 토큰 — 행 없음. 정보 누출 없이 invalid.
    return { kind: "invalid_token" };
  }

  // 4. 이미 수신거부됨 → idempotent (재호출도 200).
  if (row.unsubscribed_at) {
    return { kind: "already" };
  }

  // 5. 수신거부 처리.
  const { error: updateError } = await supabase
    .from("user_marketing_consent")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);

  if (updateError) {
    console.error("[unsubscribe] update failed", updateError.message);
    return { kind: "error" };
  }

  return { kind: "unsubscribed" };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const outcome = await processUnsubscribe(token);
  switch (outcome.kind) {
    case "unsubscribed":
      return htmlPage("수신거부 완료", "수신거부 처리되었습니다.", 200);
    case "already":
      return htmlPage("수신거부 완료", "이미 수신거부됨.", 200);
    case "invalid_token":
      return htmlPage(
        "잘못된 요청",
        "유효하지 않은 수신거부 링크입니다.",
        400,
      );
    case "misconfigured":
      return htmlPage("일시적 오류", "잠시 후 다시 시도해 주세요.", 500);
    default:
      return htmlPage("일시적 오류", "처리 중 오류가 발생했습니다.", 500);
  }
}

export async function POST(request: NextRequest) {
  // 토큰은 쿼리(?token=) 또는 JSON 바디({ token })에서 받는다.
  let token = request.nextUrl.searchParams.get("token");
  if (!token) {
    try {
      const body = (await request.json()) as { token?: unknown };
      if (typeof body?.token === "string") token = body.token;
    } catch {
      // 바디 없음/비-JSON — token은 null 유지 → invalid_token.
    }
  }

  const outcome = await processUnsubscribe(token);
  switch (outcome.kind) {
    case "unsubscribed":
      return NextResponse.json({ ok: true, status: "수신거부 처리되었습니다." });
    case "already":
      return NextResponse.json({ ok: true, status: "이미 수신거부됨." });
    case "invalid_token":
      return NextResponse.json(
        { ok: false, error: "invalid_token" },
        { status: 400 },
      );
    case "misconfigured":
      return NextResponse.json(
        { ok: false, error: "server_misconfigured" },
        { status: 500 },
      );
    default:
      return NextResponse.json(
        { ok: false, error: "unsubscribe_failed" },
        { status: 500 },
      );
  }
}
