"use client";

import { Segmented } from "antd";
import {
  AlignJustify,
  BarChart3,
  ListChecks,
  ListFilter,
  PencilLine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

type Props = {
  active: QuestionNo | null;
  onChange: (value: QuestionNo | null) => void;
  lockedTypes?: Set<QuestionNo>;
  includeAll?: boolean;
};

const ALL_VALUE = "all";

const TYPE_ICONS: Record<QuestionNo, ReactNode> = {
  51: <AlignJustify size={16} />,
  52: <PencilLine size={16} />,
  53: <BarChart3 size={16} />,
  54: <ListChecks size={16} />,
};

export function ProblemTypeTabs({
  active,
  onChange,
  lockedTypes,
  includeAll = false,
}: Props) {
  const t = useTranslations("practice.common");
  const tRecommendations = useTranslations("practice.recommendations");
  const selectedValue = includeAll ? (active ?? ALL_VALUE) : (active ?? 51);
  const allLabel = t("typeTabAll");
  const allOption = {
    value: ALL_VALUE,
    className: [
      "problem-type-tabs__item",
      selectedValue === ALL_VALUE ? "is-selected" : null,
    ]
      .filter(Boolean)
      .join(" "),
    label: (
      <span className="problem-type-tabs__option" aria-label={allLabel}>
        <span className="problem-type-tabs__left">
          <span className="problem-type-tabs__icon" aria-hidden="true">
            <ListFilter size={16} />
          </span>
          <span className="problem-type-tabs__text">{allLabel}</span>
        </span>
      </span>
    ),
  };

  return (
    <Segmented
      className={[
        "problem-type-tabs",
        includeAll ? "problem-type-tabs--with-all" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      name="practice-question-type"
      value={selectedValue}
      onChange={(value) => {
        if (value === ALL_VALUE) {
          onChange(null);
          return;
        }
        onChange(Number(value) as QuestionNo);
      }}
      options={[
        ...(includeAll ? [allOption] : []),
        ...QUESTION_NOS.map((n) => {
          const locked = lockedTypes?.has(n) ?? false;
          const selected = selectedValue === n;
          const label = tRecommendations(`typeButtonLabel${n}`);
          return {
            value: n,
            disabled: locked,
            className: [
              "problem-type-tabs__item",
              selected ? "is-selected" : null,
              locked ? "is-locked" : null,
            ]
              .filter(Boolean)
              .join(" "),
            tooltip: locked ? tRecommendations("typeLockedTooltip") : undefined,
            label: (
              <span
                className="problem-type-tabs__option"
                aria-label={locked ? t("typeTabLockedAria", { no: n }) : label}
              >
                <span className="problem-type-tabs__left">
                  <span className="problem-type-tabs__icon" aria-hidden="true">
                    {TYPE_ICONS[n]}
                  </span>
                  <span className="problem-type-tabs__text">{label}</span>
                </span>
                {locked ? (
                  <span className="problem-type-tabs__badge">
                    {tRecommendations("locked")}
                  </span>
                ) : null}
              </span>
            ),
          };
        }),
      ]}
    />
  );
}
