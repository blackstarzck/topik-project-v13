"use client";

import { Steps, Typography } from "antd";

const { Text } = Typography;

/**
 * A-03 description.md area 1 — 온보딩 진행 단계.
 * Shows current/total step ("N/3") with the step labels always paired with the
 * total, per the spec constraint (단계명 12자 이하, 전체 단계 수와 현재 단계 병기).
 * `current` defaults to 1 so a step-data load failure still renders the 1/3
 * fallback the spec requires (예외: 단계 정보 로드 실패 시 기본 1/3 진행률).
 */

const STEP_LABELS = ["계정 생성", "이메일 인증", "학습 목표"] as const;

type Props = {
  /** 0-based active step. Defaults to the last step (목표 설정) for this screen. */
  current?: number;
};

export function OnboardingSteps({ current = STEP_LABELS.length - 1 }: Props) {
  const safeCurrent = Number.isFinite(current)
    ? Math.min(Math.max(current, 0), STEP_LABELS.length - 1)
    : 0;
  return (
    <div>
      <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        {`${safeCurrent + 1}/${STEP_LABELS.length} 단계`}
      </Text>
      <Steps
        size="small"
        current={safeCurrent}
        responsive={false}
        items={STEP_LABELS.map((label) => ({ title: label }))}
      />
    </div>
  );
}
