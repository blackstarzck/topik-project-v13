"use client";

import { Tag } from "antd";
import { useTranslations } from "next-intl";

import { writingQuestionNeonClass } from "@/lib/writing/question-number-neon";

type Props = {
  questionNo: number | null;
};

export function LibraryReviewQuestionNumber({ questionNo }: Props) {
  const t = useTranslations("library.dashboard");
  const questionNoLabel = questionNo
    ? t("questionNo", { questionNo })
    : t("questionUnknown");

  if (!questionNo) {
    return (
      <Tag data-testid="library-review-question-number" className="m-0 text-sm">
        {questionNoLabel}
      </Tag>
    );
  }

  return (
    <span
      aria-label={questionNoLabel}
      data-testid="library-review-question-number"
      className={[
        "writing-question-number library-review-candidate-question-number font-['Space_Grotesk'] leading-none",
        writingQuestionNeonClass("writing-question-number", questionNo),
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {questionNo}
    </span>
  );
}
