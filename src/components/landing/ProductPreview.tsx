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

const { Title, Paragraph, Text } = Typography;

type Preview = {
  key: string;
  badge: string;
  title: string;
  summary: string;
  imageSrc?: string;
};

// 제약: 3장 이하. 실제 화면(대시보드/피드백/리포트) 기반 문구.
const PREVIEWS: Preview[] = [
  {
    key: "dashboard",
    badge: "📊 대시보드",
    title: "학습 현황 한눈에",
    summary: "오늘의 목표, 최근 제출, 추천 문제를 홈에서 바로 확인합니다.",
  },
  {
    key: "feedback",
    badge: "✍️ AI 피드백",
    title: "차원별 첨삭",
    summary: "내용·전개·어휘·문법 차원별 점수와 문장 단위 코멘트를 받습니다.",
  },
  {
    key: "report",
    badge: "📈 성장 리포트",
    title: "점수 변화 비교",
    summary: "이전 답안과 비교해 점수 변화와 약점 영역을 그래프로 봅니다.",
  },
];

function PreviewMock({ badge }: Pick<Preview, "badge">) {
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

function PreviewImage({ preview }: { preview: Preview }) {
  const [failed, setFailed] = useState(false);
  if (!preview.imageSrc || failed) {
    return <PreviewMock {...preview} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- runtime asset w/ onError fallback to summary
    <img
      src={preview.imageSrc}
      alt={`${preview.title} 화면 미리보기`}
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
  return (
    <section id="preview" style={{ marginTop: 64 }}>
      <Title level={2} style={{ textAlign: "center" }}>
        써보기 전에 미리 보기
      </Title>
      <Paragraph type="secondary" style={{ textAlign: "center" }}>
        실제 화면 그대로의 대시보드, 피드백, 리포트를 확인해보세요.
      </Paragraph>
      <div style={gridStyle}>
        {PREVIEWS.map((preview) => (
          <Card key={preview.key} size="small">
            <PreviewImage preview={preview} />
            <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
              {preview.title}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
              {preview.summary}
            </Paragraph>
          </Card>
        ))}
      </div>
    </section>
  );
}
