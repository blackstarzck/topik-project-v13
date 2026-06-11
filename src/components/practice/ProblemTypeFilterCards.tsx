"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  FileText,
  ListChecks,
  ListFilter,
  PencilLine,
} from "lucide-react";
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
    <section
      className="flex gap-3 overflow-x-auto pb-1"
      aria-label={t("typeTabAll")}
    >
      {options.map((option) => {
        const selected = active === option.value;
        return (
          <button
            key={option.key}
            type="button"
            className={[
              "flex min-w-44 flex-none items-center gap-3 rounded-3xl border bg-background p-4 text-left transition",
              selected
                ? "border-text shadow-sm"
                : "border-border hover:border-text",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            <span
              className="flex h-11 w-11 flex-none items-center justify-center rounded-default border border-border bg-surface text-text"
              aria-hidden="true"
            >
              {option.icon}
            </span>
            <span className="grid min-w-0 gap-1">
              <strong className="truncate text-sm text-text">
                {option.title}
              </strong>
              <small className="truncate text-xs text-text-secondary">
                {option.subtitle}
              </small>
            </span>
          </button>
        );
      })}
    </section>
  );
}
