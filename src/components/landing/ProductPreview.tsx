"use client";

// X-01 §4 제품 프리뷰
//   - 대시보드 / 피드백 / 리포트 화면을 축약해 사용 경험을 보여줌
//   - 제약: 프리뷰 3장 이하, 실제 화면 기반 문구 사용
//   - 예외: 프리뷰 이미지 실패 시 기능 카드 요약으로 대체
//
// No screenshot rasters ship in /public yet, so each preview renders a
// CSS-only "screen mock" (honest, no broken <img>). If a real screenshot URL
// is later supplied via `imageSrc`, the <img> renders with an onError fallback
// to the same summary card — the §4 exception is satisfied either way.

import { useState } from "react";
import { Typography } from "antd";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";

const { Title, Paragraph, Text } = Typography;

// i18n: 문구는 landing.preview.* 카탈로그에서 t()로 해석한다. 데이터 배열은
// 카탈로그 키 이름만 보관하고, 렌더 컴포넌트가 t(key)로 실제 문구를 만든다.
type PreviewTranslate = ReturnType<typeof useTranslations<"landing.preview">>;
type PreviewKey = Parameters<PreviewTranslate>[0];

type Preview = {
  key: string;
  badgeKey: PreviewKey;
  titleKey: PreviewKey;
  summaryKey: PreviewKey;
  imageSrc?: string;
};

// 제약: 3장 이하. 실제 화면(대시보드/피드백/리포트) 기반 문구.
const PREVIEWS: Preview[] = [
  {
    key: "dashboard",
    badgeKey: "dashboardBadge",
    titleKey: "dashboardTitle",
    summaryKey: "dashboardSummary",
  },
  {
    key: "feedback",
    badgeKey: "feedbackBadge",
    titleKey: "feedbackTitle",
    summaryKey: "feedbackSummary",
  },
  {
    key: "report",
    badgeKey: "reportBadge",
    titleKey: "reportTitle",
    summaryKey: "reportSummary",
  },
];

function PreviewMock({ badge }: { badge: string }) {
  return (
    <div
      className="flex min-h-[120px] flex-col gap-2 rounded-lg border border-[#e6efff] bg-[#f5f8ff] p-4"
      aria-hidden="true"
    >
      <Text strong className="!text-[13px]">
        {badge}
      </Text>
      <div className="h-2 w-[70%] rounded bg-[#c7dbff]" />
      <div className="h-2 w-[90%] rounded bg-[#dbe8ff]" />
      <div className="h-2 w-[55%] rounded bg-[#dbe8ff]" />
    </div>
  );
}

function PreviewImage({
  preview,
  badge,
  title,
}: {
  preview: Preview;
  badge: string;
  title: string;
}) {
  const t = useTranslations("landing.preview");
  const [failed, setFailed] = useState(false);
  if (!preview.imageSrc || failed) {
    return <PreviewMock badge={badge} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- runtime asset w/ onError fallback to summary
    <img
      src={preview.imageSrc}
      alt={t("imageAlt", { title })}
      className="block w-full rounded-lg"
      onError={() => setFailed(true)}
    />
  );
}

export function ProductPreview() {
  const t = useTranslations("landing.preview");
  return (
    <section id="preview" className="mt-16">
      <Title level={2} className="!text-center">
        {t("sectionTitle")}
      </Title>
      <Paragraph type="secondary" className="!text-center">
        {t("sectionBody")}
      </Paragraph>
      <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {PREVIEWS.map((preview) => {
          const badge = t(preview.badgeKey);
          const title = t(preview.titleKey);
          return (
            <AppCard key={preview.key} size="small">
              <PreviewImage preview={preview} badge={badge} title={title} />
              <Title level={5} className="!mb-1 !mt-3">
                {title}
              </Title>
              <Paragraph
                type="secondary"
                className="!mb-0 !text-[13px]"
              >
                {t(preview.summaryKey)}
              </Paragraph>
            </AppCard>
          );
        })}
      </div>
    </section>
  );
}
