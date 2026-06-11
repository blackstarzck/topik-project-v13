"use client";

import { useState } from "react";
import { App, Button, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSaveLearningGoal } from "@/lib/learning/mutations";

const { Text } = Typography;

/**
 * A-03 area 4 — 이전/다음 CTA.
 *
 * description.md 분기: "목표 급수/시험일 설정, 건너뛰기, 다음 단계 이동".
 * 여기서는 두 보조 분기를 담당한다:
 *   - 이전 단계 수정: 직전 온보딩 단계(이메일 인증)로 돌아간다.
 *   - 건너뛰기: 목표 입력 없이 진행한다. 단, B-01 대시보드는 learning_goals 가
 *     없으면 다시 온보딩으로 redirect 하므로(루프 방지), 최소 기본 목표를
 *     1회 저장한 뒤 대시보드로 이동한다. 사용자에게 "나중에 다듬을 수 있다"는
 *     점을 정직하게 안내한다.
 *
 * 메인 "저장하고 대시보드로 이동" CTA 는 LearningGoalForm 가 담당한다.
 * 제약 조건: 클릭 후 로딩 고정. 예외: 저장 실패 시 현재 화면 유지 + 재시도 안내.
 */

type Props = {
  userId: string;
  /** 이전 단계가 없을 때(직접 진입) 이전 버튼을 숨긴다. */
  previousHref?: string;
};

export function OnboardingNavCta({
  userId,
  previousHref = "/auth/verify-email",
}: Props) {
  const t = useTranslations("onboarding.nav");
  const router = useRouter();
  const { message } = App.useApp();
  const mutation = useSaveLearningGoal();
  const [skipError, setSkipError] = useState<string | null>(null);

  const handleSkip = async () => {
    setSkipError(null);
    try {
      // 최소 기본 목표(나중에 프로필/온보딩에서 수정 가능). is_active=true 로
      // 대시보드 redirect 루프를 끊는다.
      await mutation.mutateAsync({
        user_id: userId,
        topik_level: "TOPIK_II",
        target_grade: 4,
        exam_date: null,
        weekly_goal_minutes: null,
        weak_areas: [],
        is_active: true,
      });
      message.success(t("skipSuccess"));
      router.push("/dashboard");
    } catch (err) {
      // 예외: 저장 실패 시 현재 화면 유지 후 재시도 안내(토스트 + 인라인).
      const detail = err instanceof Error ? err.message : t("retryHint");
      setSkipError(detail);
      message.error(t("skipFailedToast"));
    }
  };

  return (
    <Space
      className="onboarding-goal-nav"
      orientation="vertical"
      size="small"
    >
      <Space className="onboarding-goal-nav__actions" wrap>
        <Button
          className="onboarding-goal-nav__previous"
          onClick={() => router.push(previousHref as never)}
        >
          {t("previous")}
        </Button>
        <Button
          className="onboarding-goal-nav__skip"
          type="link"
          onClick={handleSkip}
          loading={mutation.isPending}
        >
          {t("skip")}
        </Button>
      </Space>
      {skipError ? (
        <Text type="danger" className="onboarding-goal-nav__error">
          {t("skipFailedInline", { detail: skipError })}
        </Text>
      ) : null}
    </Space>
  );
}
