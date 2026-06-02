"use client";

import { Tabs } from "antd";
import { useTranslations } from "next-intl";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

type Props = {
  active: QuestionNo | null;
  onChange: (value: QuestionNo | null) => void;
  /**
   * C-01 §2 예외 — 권한 잠금 유형은 선택 불가 + 잠금 배지.
   * 잠긴 탭은 disabled 처리하고 라벨 옆에 자물쇠 아이콘을 표시한다.
   */
  lockedTypes?: Set<QuestionNo>;
};

export function ProblemTypeTabs({ active, onChange, lockedTypes }: Props) {
  const t = useTranslations("practice.common");
  return (
    <Tabs
      activeKey={active != null ? String(active) : "all"}
      onChange={(key) => {
        if (key === "all") onChange(null);
        else onChange(Number(key) as QuestionNo);
      }}
      items={[
        { key: "all", label: t("typeTabAll") },
        ...QUESTION_NOS.map((n) => {
          const locked = lockedTypes?.has(n) ?? false;
          return {
            key: String(n),
            disabled: locked,
            label: locked ? (
              // 아이콘 의존성 없이 텍스트 자물쇠 기호로 잠금 표시 (a11y: aria-label).
              <span aria-label={t("typeTabLockedAria", { no: n })}>
                {t("typeTabLocked", { no: n })}
              </span>
            ) : (
              t("questionNo", { no: n })
            ),
          };
        }),
      ]}
    />
  );
}
