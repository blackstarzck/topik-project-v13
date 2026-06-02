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
import { Card, Typography } from "antd";
import { useTranslations } from "next-intl";

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
      style={{
        borderRadius: 8,
        background: "linear-gradient(135deg,#f5f8ff 0%,#eef4ff 100%)",
        border: "1px solid #e6efff",
        padding: 16,
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      aria-hidden="true"
    >
      <Text strong style={{ fontSize: 13 }}>
        {badge}
      </Text>
      <div
        style={{
          height: 8,
          width: "70%",
          background: "#c7dbff",
          borderRadius: 4,
        }}
      />
      <div
        style={{ height: 8, width: "90%", background: "#dbe8ff", borderRadius: 4 }}
      />
      <div
        style={{ height: 8, width: "55%", background: "#dbe8ff", borderRadius: 4 }}
      />
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
      style={{ width: "100%", borderRadius: 8, display: "block" }}
      onError={() => setFailed(true)}
    />
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginTop: 24,
};

export function ProductPreview() {
  const t = useTranslations("landing.preview");
  return (
    <section id="preview" style={{ marginTop: 64 }}>
      <Title level={2} style={{ textAlign: "center" }}>
        {t("sectionTitle")}
      </Title>
      <Paragraph type="secondary" style={{ textAlign: "center" }}>
        {t("sectionBody")}
      </Paragraph>
      <div style={gridStyle}>
        {PREVIEWS.map((preview) => {
          const badge = t(preview.badgeKey);
          const title = t(preview.titleKey);
          return (
            <Card key={preview.key} size="small">
              <PreviewImage preview={preview} badge={badge} title={title} />
              <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
                {title}
              </Title>
              <Paragraph
                type="secondary"
                style={{ marginBottom: 0, fontSize: 13 }}
              >
                {t(preview.summaryKey)}
              </Paragraph>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
