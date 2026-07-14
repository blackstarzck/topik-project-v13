import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { LegalDocument } from "@/components/legal/TermsDocument";
import { AppCard } from "@/components/shared/AppCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { getPublishedLegalDocument } from "@/lib/legal/documents";

// X-14 개인정보처리방침 — 공개 정적 legal 화면.
// /sign-up 동의 라벨(new tab)·/terms 에서 연결되는 placeholder. 정식 처리방침은
// 법무/개인정보 검토 후 운영 진입 전 별도 작업. 데이터 읽기/쓰기 없는 server
// component (정적 legal 페이지 house convention: home/terms 와 동일하게 antd 미사용).
// 제품 범위는 docs/prd.md, route ownership은 src/lib/routes.ts를 따른다.

// 개인정보처리방침은 관리자 발행 시 즉시 반영되어야 하므로 매 요청마다 최신 DB
// 상태를 읽는다.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle") };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const doc = await getPublishedLegalDocument("privacy", locale);
  const t = await getTranslations("legal.privacy");
  // §3 처리 항목 요약: <strong>레이블</strong> + 본문. t.rich 로 label 태그를 굵게.
  const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;
  return (
    <PublicShell>
      <PageContainer size="default" className="legal-page-container">
        {doc && !doc.is_placeholder ? (
          <LegalDocument doc={doc} testIdPrefix="privacy" />
        ) : (
          <AppCard className="legal-document-card" data-testid="privacy-card">
            <div className="legal-document-card__content flex w-full flex-col gap-6">
              {/* §1 페이지 제목 */}
              <h1>{t("heading")}</h1>

              {/* §2 임시 안내 고지 — placeholder 상태를 숨기지 않는다 */}
              <section data-testid="privacy-intro">
                <p>{t("intro")}</p>
              </section>

              {/* §3 처리 항목 요약 — 수집/이용/보관/제3자(외부 LLM 전송) */}
              <section data-testid="privacy-summary">
                <h2>{t("summaryTitle")}</h2>
                <ul>
                  <li>{t.rich("summaryCollect", { strong })}</li>
                  <li>{t.rich("summaryPurpose", { strong })}</li>
                  <li>{t.rich("summaryRetention", { strong })}</li>
                  <li>{t.rich("summaryThirdParty", { strong })}</li>
                </ul>
                <p className="mt-3">{t("summaryScopeNote")}</p>
              </section>

              {/* §4 갱신 안내 — 정식 게시 시 갱신 및 가입자 안내 예정 */}
              <section data-testid="privacy-update">
                <h2>{t("updateTitle")}</h2>
                <p>{t("updateBody")}</p>
              </section>

              {/* §5 관련 링크 — 이용약관 / 홈 / 가입 (escape route) */}
              <section data-testid="privacy-related-links">
                <p>
                  {t("relatedLabel")}
                  <Link href="/terms">{t("linkTerms")}</Link>
                  {" · "}
                  <Link href="/">{t("linkHome")}</Link>
                  {" · "}
                  <Link href="/sign-up">{t("linkSignUp")}</Link>
                </p>
              </section>
            </div>
          </AppCard>
        )}
      </PageContainer>
    </PublicShell>
  );
}
