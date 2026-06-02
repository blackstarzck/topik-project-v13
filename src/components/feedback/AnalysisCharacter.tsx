"use client";

import { Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

const FRAMES = ["📖", "✏️", "🔍", "📝", "✨"];
/** reduce-motion일 때 깜빡임 없이 고정으로 보여줄 단일 프레임. */
const STATIC_FRAME = "📝";

type Props = {
  /** current step index 0-based; cycles emoji */
  step: number;
  /**
   * 모션 비활성 (D-M2 description region 2 예외). true면 프레임 전환/펄스
   * 애니메이션 없이 정적 이미지로 대체한다.
   */
  reduceMotion?: boolean;
};

/**
 * D-M2 분석 캐릭터 (description region 2).
 * 제약: 애니메이션은 1개 핵심 루프, 텍스트를 가리지 않음.
 * 예외: 모션 비활성 설정 시 정적 이미지로 대체.
 */
export function AnalysisCharacter({ step, reduceMotion }: Props) {
  const t = useTranslations("feedback.analysis");
  const frame = reduceMotion ? STATIC_FRAME : FRAMES[step % FRAMES.length];
  return (
    <div
      style={{
        fontSize: 64,
        textAlign: "center",
        lineHeight: 1.4,
      }}
      aria-label={t("characterAria")}
      role="img"
    >
      <div
        style={
          reduceMotion
            ? undefined
            : { animation: "talkpik-analysis-pulse 1.6s ease-in-out infinite" }
        }
      >
        {frame}
      </div>
      <Text type="secondary" style={{ fontSize: 14 }}>
        {t("characterCaption")}
      </Text>
      {reduceMotion ? null : (
        <style>{`@keyframes talkpik-analysis-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
      )}
    </div>
  );
}
