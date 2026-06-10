"use client";

import { Tabs } from "antd";
import { useTranslations } from "next-intl";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

type Props = {
  active: QuestionNo | null;
  onChange: (value: QuestionNo | null) => void;
  lockedTypes?: Set<QuestionNo>;
};

export function ProblemTypeTabs({ active, onChange, lockedTypes }: Props) {
  const t = useTranslations("practice.common");
  return (
    <Tabs
      className="recommendation-type-tabs"
      activeKey={String(active ?? 51)}
      onChange={(key) => onChange(Number(key) as QuestionNo)}
      items={QUESTION_NOS.map((n) => {
        const locked = lockedTypes?.has(n) ?? false;
        return {
          key: String(n),
          disabled: locked,
          label: locked ? (
            <span
              className="recommendation-type-tabs__label"
              aria-label={t("typeTabLockedAria", { no: n })}
            >
              {t("typeTabLocked", { no: n })}
            </span>
          ) : (
            <span className="recommendation-type-tabs__label">
              {t("questionNo", { no: n })}
            </span>
          ),
        };
      })}
    />
  );
}
