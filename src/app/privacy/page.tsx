import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AppCard } from "@/components/shared/AppCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

// X-14 개인정보처리방침 — 기존 34개 Wireframe 이후 추가된 공개 정적 legal 화면.
// /sign-up 동의 라벨(new tab)·/terms 에서 연결되는 placeholder. 정식 처리방침은
// 법무/개인정보 검토 후 운영 진입 전 별도 작업. 데이터 읽기/쓰기 없는 server
// component (정적 legal 페이지 house convention: home/terms 와 동일하게 antd 미사용).
// docs/Wireframe/36-X-14-privacy-policy/{description,functional-spec}.md 참고.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle") };
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

// §3 요약 본문과 목록 사이의 작은 간격(원래 인라인 값 유지, off-scale).
const scopeNoteMarginTop = 12; // ai-check: allow-inline-number preserve original 12px scope-note gap (off 8-scale)

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  // §3 처리 항목 요약: <strong>레이블</strong> + 본문. t.rich 로 label 태그를 굵게.
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <PublicShell>
      <PageContainer size="narrow">
        <AppCard data-testid="privacy-card">
          {/* §1 페이지 제목 */}
          <h1>{t("heading")}</h1>

          {/* §2 임시 안내 고지 — placeholder 상태를 숨기지 않는다 */}
          <section style={sectionStyle} data-testid="privacy-intro">
            <p>{t("intro")}</p>
          </section>

          {/* §3 처리 항목 요약 — 수집/이용/보관/제3자(외부 LLM 전송) */}
          <section style={sectionStyle} data-testid="privacy-summary">
            <h2>{t("summaryTitle")}</h2>
            <ul>
              <li>{t.rich("summaryCollect", { strong })}</li>
              <li>{t.rich("summaryPurpose", { strong })}</li>
              <li>{t.rich("summaryRetention", { strong })}</li>
              <li>{t.rich("summaryThirdParty", { strong })}</li>
            </ul>
            <p style={{ marginTop: scopeNoteMarginTop }}>
              {t("summaryScopeNote")}
            </p>
          </section>

          {/* §4 갱신 안내 — 정식 게시 시 갱신 및 가입자 안내 예정 */}
          <section style={sectionStyle} data-testid="privacy-update">
            <h2>{t("updateTitle")}</h2>
            <p>{t("updateBody")}</p>
          </section>

          {/* §5 관련 링크 — 이용약관 / 홈 / 가입 (escape route) */}
          <section style={sectionStyle} data-testid="privacy-related-links">
            <p>
              {t("relatedLabel")}
              <Link href="/terms">{t("linkTerms")}</Link>
              {" · "}
              <Link href="/">{t("linkHome")}</Link>
              {" · "}
              <Link href="/sign-up">{t("linkSignUp")}</Link>
            </p>
          </section>
        </AppCard>
      </PageContainer>
    </PublicShell>
  );
}
