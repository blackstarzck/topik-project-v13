import { writingQuestionNeonClass } from "@/lib/writing/question-number-neon";

export function LibraryProblemsQuestionNumber({
  className,
  questionNo,
}: {
  className?: string;
  questionNo: number | null;
}) {
  if (questionNo == null) return null;

  return (
    <span
      aria-label={`TOPIK 쓰기 ${questionNo}번`}
      data-testid="library-problems-question-number"
      className={[
        "library-problems-question-number",
        writingQuestionNeonClass(
          "library-problems-question-number",
          questionNo,
        ),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {questionNo}
    </span>
  );
}
