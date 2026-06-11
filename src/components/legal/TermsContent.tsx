"use client";

// X-13 이용약관 placeholder 본문.
//
// 기존 34개 Wireframe 이후 코드베이스 기준으로 추가된 화면. 정식 법무 검토
// 약관은 운영 진입 전 별도 작업으로 게시되며, 현 화면은 회원가입 동의 라벨/
// 랜딩 헤더에서 연결되는 최소 disclosure placeholder다.
//
// "use client": antd 복합 컴포넌트(Typography.Title/Paragraph)를 서버
// 컴포넌트에서 쓰면 prod-only React #130 크래시가 나므로 필수.

import Link from "next/link";
import { Typography } from "antd";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";

const { Title, Paragraph, Text } = Typography;

export function TermsContent() {
  const t = useTranslations("legal.terms");
  return (
    <AppCard data-testid="terms-card">
      <div className="flex w-full flex-col gap-6">
        {/* §1 법적 고지 페이지 (제목 + 임시 약관 안내) */}
        <div>
          <Title level={2} className="!mb-2">
            {t("heading")}
          </Title>
          <Paragraph className="!mb-0" data-testid="terms-intro">
            {t("intro")}
          </Paragraph>
          <Paragraph
            type="secondary"
            className="!mb-0 !mt-2"
            data-testid="terms-placeholder-notice"
          >
            {t("placeholderNotice")}
          </Paragraph>
        </div>

        {/* §2 임시 약관 요약 */}
        <div data-testid="terms-summary">
          <Title level={4} className="!mb-2">
            {t("summaryTitle")}
          </Title>
          <ul className="m-0 list-disc pl-5">
            <li className="mb-2">{t("summaryTool")}</li>
            <li className="mb-2">{t("summaryDataUse")}</li>
            <li className="mb-2">
              {t.rich("summaryPrivacy", {
                privacyLink: (chunks) => <Link href="/privacy">{chunks}</Link>,
              })}
            </li>
            <li>{t("summaryConsent")}</li>
          </ul>
        </div>

        {/* §3 운영 문의 안내 — 존재하지 않는 채널을 꾸며내지 않는다 */}
        <div data-testid="terms-contact">
          <Title level={4} className="!mb-2">
            {t("contactTitle")}
          </Title>
          <Paragraph type="secondary" className="!mb-0">
            {t("contactBody")}
          </Paragraph>
        </div>

        {/* §4 Escape 링크 — 홈 / 회원가입 / 개인정보처리방침 */}
        <Paragraph className="!mb-0" data-testid="terms-shortcuts">
          <Text type="secondary">{t("shortcutsLabel")}</Text>
          <Link href="/">{t("linkHome")}</Link>
          {" · "}
          <Link href="/sign-up">{t("linkBackToSignUp")}</Link>
          {" · "}
          <Link href="/privacy">{t("linkPrivacy")}</Link>
        </Paragraph>
      </div>
    </AppCard>
  );
}
