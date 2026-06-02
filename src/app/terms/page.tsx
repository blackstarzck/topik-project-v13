import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TermsContent } from "@/components/legal/TermsContent";

// X-13 이용약관 — 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면.
// 회원가입 동의 라벨(새 탭) 및 랜딩 헤더 "이용약관" 메뉴에서 연결되는 공개
// legal placeholder. 정식 법무 검토 약관은 운영 진입 전 별도 작업으로 게시.
// PUBLIC_PATHS(/terms)로 세션 없이 접근 가능 (src/lib/routes.ts).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("metaTitle") };
}

export default function TermsPage() {
  return (
    <main style={{ padding: "2.5rem 1rem", maxWidth: 760, margin: "0 auto" }}>
      <TermsContent />
    </main>
  );
}
