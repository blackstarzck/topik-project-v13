"use client";

import { Tabs, Tooltip } from "antd";
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

function TabLabel({
  icon,
  text,
  badge,
  ariaLabel,
}: {
  icon: ReactNode;
  text: string;
  badge?: string;
  ariaLabel?: string;
}) {
  return (
    <span className="problem-type-tabs__label" aria-label={ariaLabel}>
      <span className="problem-type-tabs__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="problem-type-tabs__text">{text}</span>
      {badge ? <span className="problem-type-tabs__badge">{badge}</span> : null}
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
