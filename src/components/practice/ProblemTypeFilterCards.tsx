"use client";

import type { ReactNode } from "react";
import { BarChart3, FileText, ListFilter, ListChecks, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";

const TYPE_ICONS: Record<QuestionNo, ReactNode> = {
  51: <PencilLine size={22} />,
  52: <FileText size={22} />,
  53: <BarChart3 size={22} />,
  54: <ListChecks size={22} />,
};

type Props = {
  active: QuestionNo | null;
  onChange: (value: QuestionNo | null) => void;
};

export function ProblemTypeFilterCards({ active, onChange }: Props) {
  const t = useTranslations("practice.common");
  const options: Array<{
    key: string;
    value: QuestionNo | null;
    title: string;
    subtitle: string;
    icon: ReactNode;
  }> = [
    {
      key: "all",
      value: null,
      title: t("typeTabAll"),
      subtitle: "51-54",
      icon: <ListFilter size={22} />,
    },
    ...QUESTION_NOS.map((no) => ({
      key: String(no),
      value: no,
      title: t("questionNo", { no }),
      subtitle: t(`questionType${no}`),
      icon: TYPE_ICONS[no],
    })),
  ];

  return (
    <section className="problem-list-type-filter" aria-label={t("typeTabAll")}>
      {options.map((option) => {
        const selected = active === option.value;
        return (
          <button
            key={option.key}
            type="button"
            className={[
              "problem-list-type-filter__item",
              selected ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            <span className="problem-list-type-filter__icon">
              {option.icon}
            </span>
            <span className="problem-list-type-filter__copy">
              <strong>{option.title}</strong>
              <small>{option.subtitle}</small>
            </span>
          </button>
        );
      })}
    </section>
  );
}
