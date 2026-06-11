"use client";

import { Steps, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

/**
 * A-03 description.md area 1 — 온보딩 진행 단계.
 * Shows current/total step ("N/3") with the step labels always paired with the
 * total, per the spec constraint (단계명 12자 이하, 전체 단계 수와 현재 단계 병기).
 * `current` defaults to 1 so a step-data load failure still renders the 1/3
 * fallback the spec requires (예외: 단계 정보 로드 실패 시 기본 1/3 진행률).
 *
 * i18n: 단계 라벨 문구는 onboarding.steps.* 카탈로그에서 t()로 해석한다. 단계
 * 키(value)는 불변, 라벨만 해석한다.
 */

const STEP_KEYS = ["createAccount", "verifyEmail", "learningGoal"] as const;

type Props = {
  /** 0-based active step. Defaults to the last step (목표 설정) for this screen. */
  current?: number;
};

export function OnboardingSteps({ current = STEP_KEYS.length - 1 }: Props) {
  const t = useTranslations("onboarding.steps");
  const safeCurrent = Number.isFinite(current)
    ? Math.min(Math.max(current, 0), STEP_KEYS.length - 1)
    : 0;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Text type="secondary" className="block text-center !text-sm">
        {t("counter", {
          current: safeCurrent + 1,
          total: STEP_KEYS.length,
        })}
      </Text>
      <Steps
        className="mt-3"
        size="small"
        current={safeCurrent}
        responsive={false}
        items={STEP_KEYS.map((key) => ({
          title: t(`labels.${key}` as Parameters<typeof t>[0]),
        }))}
      />
    </div>
  );
}
