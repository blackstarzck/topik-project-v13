// Phase 8 follow-up P0 fix (2026-05-27):
//
// /auth/callback이 Route Handler로 전환되면서, implicit flow의 #fragment를
// 처리하는 client component를 더 이상 callback에서 직접 호스팅할 수 없게 됨
// (Route Handler는 HTML 렌더 불가). 별도 server page에 호스팅 — Route Handler가
// query 없는 callback 요청을 본 page로 redirect → 브라우저가 RFC 7231에 따라
// fragment를 자동 보존 → client component가 window.location.hash 파싱.
//
// Spec: docs/Wireframe/33-X-11-auth-error/description.md (implicit flow fragment fallback)

import { Suspense } from "react";

import { CallbackFragmentFallback } from "@/components/auth/CallbackFragmentFallback";
import { sanitizeNext } from "@/lib/auth/error-mapping";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function CallbackFragmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(pickFirst(params.next));

  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 640, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <CallbackFragmentFallback next={next} />
      </Suspense>
    </main>
  );
}
