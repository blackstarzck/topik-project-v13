// 회원 탈퇴(self-service 계정 삭제) 실행 route handler (POST).
//
// 구현 브리프: docs/sot-change-proposals/2026-06-22-account-deletion-self-service.md
//
// Flow:
//   1. POST /auth/account-delete (설정 화면 danger-zone 모달의 form submit)
//   2. supabase.rpc('request_account_deletion') — 호출자 본인 profiles.status=
//      'deleted', deleted_at=now() (소프트 삭제). 멱등.
//   3. supabase.auth.signOut({ scope: 'global' }) — 전 기기 refresh token 폐기 +
//      현재 기기 세션 쿠키 정리. (다른 기기는 다음 이동 시 workspace layout 의
//      status 게이트 → /auth/account-inactive 로 정리된다.)
//   4. Redirect 303 → /login?reason=withdrawn.
//
// 실패 처리: RPC 오류 시 세션을 유지한 채 /settings/account?delete=error 로
//   돌려보내 danger-zone 이 인라인 오류를 표시하게 한다.
//
// Security:
//   - POST 전용 (CSRF: GET 링크/이미지로 트리거 불가).
//   - 인증된 본인만 동작(getUser). RPC 자체도 authenticated 전용 + auth.uid()
//     본인 행만 변경.
//   - service-role 불필요: 세션 무효화는 사용자 자신의 세션으로 scope:'global'.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 303,
    });
  }

  const { error: rpcError } = await supabase.rpc("request_account_deletion");
  if (rpcError) {
    console.error("[auth/account-delete] rpc error", {
      code: rpcError.code,
      message: rpcError.message,
    });
    return NextResponse.redirect(
      new URL("/settings/account?delete=error", request.url),
      { status: 303 },
    );
  }

  // 전 기기 세션 무효화 + 현재 쿠키 정리. 실패해도 status=deleted 이미 기록돼
  // 다음 요청에서 layout 게이트가 잡으므로 치명적이지 않다.
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
    new URL("/login?reason=withdrawn", request.url),
    { status: 303 },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", allow: ["POST"] },
    { status: 405, headers: { Allow: "POST" } },
  );
}
