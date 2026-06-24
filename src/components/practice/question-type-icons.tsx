"use client";

import type { ReactNode } from "react";
import {
  DirectboxNotifIcon,
  DocumentTextIcon,
  PresentationChartIcon,
  ProgrammingArrowsIcon,
  type AppIcon,
} from "@/components/shared/AppIcons";
import type { QuestionNo } from "@/lib/practice/types";

export const QUESTION_TYPE_ICON_NAMES: Record<QuestionNo, string> = {
  51: "DirectboxNotif",
  52: "ProgrammingArrows",
  53: "PresentationChart",
  54: "DocumentText",
};

const QUESTION_TYPE_ICONS: Record<QuestionNo, AppIcon> = {
  51: DirectboxNotifIcon,
  52: ProgrammingArrowsIcon,
  53: PresentationChartIcon,
  54: DocumentTextIcon,
};

export function questionTypeIcon(
  questionNo: QuestionNo,
  size: number,
): ReactNode {
  const Icon = QUESTION_TYPE_ICONS[questionNo];

  return (
    <Icon
      size={size}
      data-app-icon-name={QUESTION_TYPE_ICON_NAMES[questionNo]}
      aria-hidden="true"
    />
  );
}
