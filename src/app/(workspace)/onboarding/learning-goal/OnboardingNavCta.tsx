"use client";

import { useState } from "react";
import { App, Button, ConfigProvider, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSaveLearningGoal } from "@/lib/learning/mutations";

const { Text } = Typography;

const skipButtonTheme = {
  components: {
    Button: {
      textHoverBg: "transparent",
    },
  },
};

/**
 * A-03 area 4 — 건너뛰기 CTA.
 *
 * description.md 분기: "목표 급수/시험일 설정, 건너뛰기, 다음 단계 이동".
 * 이 컴포넌트는 목표 입력 없이 진행하는 보조 분기를 담당한다. 단, B-01
 * 대시보드는 learning_goals 가 없으면 다시 온보딩으로 redirect 하므로(루프
 * 방지), 최소 기본 목표를 1회 저장한 뒤 대시보드로 이동한다.
 *
 * 메인 "저장하고 대시보드로 이동" CTA 는 LearningGoalForm 가 담당한다.
 * 제약 조건: 클릭 후 로딩 고정. 예외: 저장 실패 시 현재 화면 유지 + 재시도 안내.
 */

type Props = {
  userId: string;
};

export function OnboardingNavCta({ userId }: Props) {
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
    <div className="mx-auto grid w-full max-w-3xl gap-2">
      <ConfigProvider theme={skipButtonTheme}>
        <Button
          block
          size="large"
          type="text"
          className="onboarding-skip-cta"
          onClick={handleSkip}
          loading={mutation.isPending}
        >
          {t("skip")}
        </Button>
      </ConfigProvider>
      {skipError ? (
        <Text type="danger" className="!text-xs">
          {t("skipFailedInline", { detail: skipError })}
        </Text>
      ) : null}
    </div>
  );
}
