import type { NormalizedBlank } from "@/lib/writing/problem-normalizer";
import {
  build51AnswerText,
  build52AnswerText,
  count51AnswerChars,
  count52AnswerChars,
  isShortAnswer51DraftJson,
  isShortAnswer52DraftJson,
  type ShortAnswerQuestion51Json,
  type ShortAnswerQuestion52Json,
  type WritingDraftRow,
} from "@/lib/writing/types";

export type ShortAnswerAnswers = Record<string, string>;
export type ShortAnswerDraftJson =
  | ShortAnswerQuestion51Json
  | ShortAnswerQuestion52Json;

export type ShortAnswerWritingAdapter = {
  questionNo: 51 | 52;
  buildAnswerJson: (answers: ShortAnswerAnswers) => ShortAnswerDraftJson;
  buildAnswerText: (
    answers: ShortAnswerAnswers,
    blanks: NormalizedBlank[],
  ) => string;
  countAnswerChars: (answers: ShortAnswerAnswers) => number;
  isAnswerJson: (value: unknown) => value is ShortAnswerDraftJson;
};

export const shortAnswerWriting51Adapter: ShortAnswerWritingAdapter = {
  questionNo: 51,
  buildAnswerJson: (answers) => ({
    _v: "51.v1",
    blanks: { ...answers },
  }),
  buildAnswerText: build51AnswerText,
  countAnswerChars: count51AnswerChars,
  isAnswerJson: isShortAnswer51DraftJson,
};

export const shortAnswerWriting52Adapter: ShortAnswerWritingAdapter = {
  questionNo: 52,
  buildAnswerJson: (answers) => ({
    _v: "52.v1",
    blanks: { ...answers },
  }),
  buildAnswerText: build52AnswerText,
  countAnswerChars: count52AnswerChars,
  isAnswerJson: isShortAnswer52DraftJson,
};

export function readInitialShortAnswerAnswers(
  adapter: ShortAnswerWritingAdapter,
  blanks: NormalizedBlank[],
  draft: Pick<WritingDraftRow, "answer_json" | "answer_text"> | null,
): ShortAnswerAnswers {
  const draftJson = draft?.answer_json;
  if (adapter.isAnswerJson(draftJson)) {
    return Object.fromEntries(
      blanks.map((blank) => [blank.label, draftJson.blanks[blank.label] ?? ""]),
    );
  }

  return Object.fromEntries(
    blanks.map((blank, index) => [
      blank.label,
      index === 0 ? (draft?.answer_text ?? "") : "",
    ]),
  );
}

export function createShortAnswerPayload(
  adapter: ShortAnswerWritingAdapter,
  answers: ShortAnswerAnswers,
  blanks: NormalizedBlank[],
) {
  return {
    answerJson: adapter.buildAnswerJson(answers),
    answerText: adapter.buildAnswerText(answers, blanks),
    charCount: adapter.countAnswerChars(answers),
  };
}

export function readShortAnswerSnapshotAnswers(
  adapter: ShortAnswerWritingAdapter,
  value: unknown,
): ShortAnswerAnswers | undefined {
  return adapter.isAnswerJson(value) ? { ...value.blanks } : undefined;
}
