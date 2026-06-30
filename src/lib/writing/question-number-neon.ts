const WRITING_QUESTION_NEON_VARIANTS = {
  51: "q51",
  52: "q52",
  53: "q53",
  54: "q54",
} as const;

type WritingQuestionNo = keyof typeof WRITING_QUESTION_NEON_VARIANTS;

export type WritingQuestionNeonVariant =
  (typeof WRITING_QUESTION_NEON_VARIANTS)[WritingQuestionNo];

export function writingQuestionNeonVariant(
  questionNo: number | null | undefined,
): WritingQuestionNeonVariant | null {
  if (
    questionNo === 51 ||
    questionNo === 52 ||
    questionNo === 53 ||
    questionNo === 54
  ) {
    return WRITING_QUESTION_NEON_VARIANTS[questionNo];
  }

  return null;
}

export function writingQuestionNeonClass(
  classPrefix: string,
  questionNo: number | null | undefined,
) {
  const variant = writingQuestionNeonVariant(questionNo);
  return variant ? `${classPrefix}--${variant}` : null;
}
