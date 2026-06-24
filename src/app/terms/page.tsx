import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { TermsContent } from "@/components/legal/TermsContent";
import { TermsDocument } from "@/components/legal/TermsDocument";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { getPublishedLegalDocument } from "@/lib/legal/documents";

// X-13 이용약관 — 공개 약관 페이지. 관리자(operation_policies)에서 발행된 약관이
// v13 legal_documents 로 투영되며, 이 페이지는 published 약관 본문을 DB에서 읽어
// 표시한다(오너 결정 2026-06-22: 관리자=단일 SoT, v13=표시 전용). 발행된 정식
// 약관이 없을 때만 기존 i18n placeholder(TermsContent)로 폴백한다.
// PUBLIC_PATHS(/terms)로 세션 없이 접근 가능 (src/lib/routes.ts).

// 약관은 관리자 발행 시 즉시 반영되어야 하므로 매 요청마다 최신 DB 상태를 읽는다.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("metaTitle") };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const doc = await getPublishedLegalDocument("terms", locale);

  return (
    <PublicShell>
      <PageContainer size="default" className="legal-page-container">
        {doc && !doc.is_placeholder ? (
          <TermsDocument doc={doc} />
        ) : (
          <TermsContent />
        )}
      </PageContainer>
    </PublicShell>
  );
}
