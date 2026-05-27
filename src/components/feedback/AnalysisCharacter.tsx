"use client";

import { Typography } from "antd";

const { Text } = Typography;

const FRAMES = ["📖", "✏️", "🔍", "📝", "✨"];

type Props = {
  /** current step index 0-based; cycles emoji */
  step: number;
};

/**
 * Phase 7-D Task 8 (P1-4) — D-M2 분석 캐릭터.
 * 단순 emoji cycle. Tier 2 OOS-1 (real LLM)이 풀린 후 실 아바타로 교체 가능.
 */
export function AnalysisCharacter({ step }: Props) {
  const frame = FRAMES[step % FRAMES.length];
  return (
    <div
      style={{
        fontSize: 64,
        textAlign: "center",
        lineHeight: 1.4,
      }}
      aria-label={`분석 캐릭터 단계 ${step + 1}`}
    >
      <div>{frame}</div>
      <Text type="secondary" style={{ fontSize: 14 }}>
        AI가 답안을 살펴보는 중...
      </Text>
    </div>
  );
}
