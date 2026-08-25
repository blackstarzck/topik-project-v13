"use client";

import { Tabs, Tooltip } from "antd";
import { ListFilter } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";
import { questionTypeIcon } from "./question-type-icons";
import styles from "./ProblemTypeTabs.module.css";

type Props = {
  active: QuestionNo | null;
  onChange: (value: QuestionNo | null) => void;
  lockedTypes?: Set<QuestionNo>;
  includeAll?: boolean;
};

const ALL_VALUE = "all";

const TYPE_ICONS: Record<QuestionNo, ReactNode> = {
  51: questionTypeIcon(51, 16),
  52: questionTypeIcon(52, 16),
  53: questionTypeIcon(53, 16),
  54: questionTypeIcon(54, 16),
};

function TabLabel({
  icon,
  text,
  badge,
  ariaLabel,
  active,
}: {
  icon: ReactNode;
  text: string;
  badge?: string;
  ariaLabel?: string;
  active: boolean;
}) {
  return (
    <span
      className={["problem-type-tabs__label", styles.label].join(" ")}
      aria-label={ariaLabel}
    >
      <span
        className={["problem-type-tabs__icon", styles.icon].join(" ")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span
        className={[
          "problem-type-tabs__text",
          styles.text,
          active ? styles.activeText : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {text}
      </span>
      {badge ? (
        <span className={["problem-type-tabs__badge", styles.badge].join(" ")}>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

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

  const items = [
    ...(includeAll
      ? [
          {
            key: ALL_VALUE,
            label: (
              <TabLabel
                icon={<ListFilter size={16} />}
                text={allLabel}
                ariaLabel={allLabel}
                active={selectedValue === ALL_VALUE}
              />
            ),
          },
        ]
      : []),
    ...QUESTION_NOS.map((n) => {
      const locked = lockedTypes?.has(n) ?? false;
      const label = tRecommendations(`typeButtonLabel${n}`);
      const node = (
        <TabLabel
          icon={TYPE_ICONS[n]}
          text={label}
          badge={locked ? tRecommendations("locked") : undefined}
          ariaLabel={locked ? t("typeTabLockedAria", { no: n }) : label}
          active={selectedValue === n}
        />
      );
      return {
        key: String(n),
        disabled: locked,
        label: locked ? (
          <Tooltip title={tRecommendations("typeLockedTooltip")}>
            {node}
          </Tooltip>
        ) : (
          node
        ),
      };
    }),
  ];

  return (
    <Tabs
      type="card"
      className={[
        "problem-type-tabs",
        styles.root,
        includeAll ? "problem-type-tabs--with-all" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      activeKey={String(selectedValue)}
      onChange={(key) => {
        if (key === ALL_VALUE) {
          onChange(null);
          return;
        }
        onChange(Number(key) as QuestionNo);
      }}
      items={items}
    />
  );
}
