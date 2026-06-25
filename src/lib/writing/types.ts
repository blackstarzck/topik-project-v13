import type { Tables, TablesInsert } from "../supabase/types";

export type QuestionNo = 51 | 52 | 53 | 54;
export const QUESTION_NOS: readonly QuestionNo[] = [51, 52, 53, 54];

export function isQuestionNo(value: unknown): value is QuestionNo {
  return (
    typeof value === "number" &&
    (QUESTION_NOS as readonly number[]).includes(value)
  );
}

export function isShortAnswer(n: QuestionNo): boolean {
  return n === 51 || n === 52;
}

export function isLongForm(n: QuestionNo): boolean {
  return n === 53 || n === 54;
}

export type AutosaveStatus = Tables<"writing_drafts">["autosave_status"];
export type FeedbackStatus = Tables<"writing_submissions">["feedback_status"];
export type FeedbackOverallStatus = Tables<"writing_feedback">["status"];
export type FeedbackDimensionKey =
  Tables<"feedback_dimension_scores">["dimension"];

export const FEEDBACK_DIMENSIONS: readonly FeedbackDimensionKey[] = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
  "language",
];

export type WritingDraftRow = Tables<"writing_drafts">;
export type WritingSubmissionRow = Tables<"writing_submissions">;
export type WritingFeedbackRow = Tables<"writing_feedback">;
export type FeedbackDimensionScoreRow = Tables<"feedback_dimension_scores">;
export type SentenceFeedbackRow = Tables<"sentence_feedback">;
export type ComparisonReportRow = Tables<"comparison_reports">;

export type WritingDraftInsert = TablesInsert<"writing_drafts">;

export type FeedbackBundle = {
  feedback: WritingFeedbackRow;
  dimensions: FeedbackDimensionScoreRow[];
  sentences: SentenceFeedbackRow[];
};

export function isFeedbackComplete(status: FeedbackStatus): boolean {
  return status === "complete" || status === "failed";
}

// Phase 7 Task 3 + 4 — LongForm answer_json schemas.
// Plan rev3 Task 3 + Codex Round 1 P1-PLAN-6.

export type ChecklistItemStatus = "complete" | "warning" | "unchecked";

export const ESSAY_CHECKLIST_KEYS = [
  "intro",
  "body",
  "conclusion",
  "evidence",
  "connectors",
  "topic_fit",
] as const;
export type EssayChecklistKey = (typeof ESSAY_CHECKLIST_KEYS)[number];

export type LongFormQuestion53Json = {
  _v: "53.v1";
  sections: {
    intro: string;
    body: string;
    conclusion: string;
  };
};

export type LongFormQuestion54Json = {
  _v: "54.v1";
  text: string;
  checklist: Record<EssayChecklistKey, ChecklistItemStatus>;
};

export type ShortAnswerQuestion51Json = {
  _v: "51.v1";
  blanks: Record<string, string>;
};

export type LongFormDraftJson =
  | LongFormQuestion53Json
  | LongFormQuestion54Json;

export function emptyChecklist(): Record<EssayChecklistKey, ChecklistItemStatus> {
  return {
    intro: "unchecked",
    body: "unchecked",
    conclusion: "unchecked",
    evidence: "unchecked",
    connectors: "unchecked",
    topic_fit: "unchecked",
  };
}

/**
 * Combine 53번 sections into a single answer_text used by:
 * - submit RPC validation
 * - char_count for hard/recommended limit checks
 * - feedback pipeline (legacy answer_text consumer)
 */
export function combine53Sections(
  sections: LongFormQuestion53Json["sections"],
): string {
  const parts = [sections.intro, sections.body, sections.conclusion]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.join("\n\n");
}

// Strict shape guard — `_v` alone is not enough (Codex Round 1 P1-2).
// Validates section keys for 53, and text + 6 checklist keys with allowed
// status values for 54. Used by LongFormEditor before reading initialDraft.
const ALLOWED_STATUS: readonly ChecklistItemStatus[] = [
  "complete",
  "warning",
  "unchecked",
];

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isShortAnswer51DraftJson(
  value: unknown,
): value is ShortAnswerQuestion51Json {
  if (!isStringRecord(value)) return false;
  if (value._v !== "51.v1") return false;
  if (!isStringRecord(value.blanks)) return false;
  return Object.values(value.blanks).every((item) => typeof item === "string");
}

export function build51AnswerText(
  blanks: Record<string, string>,
  orderedBlanks: Array<{ label: string }>,
): string {
  return orderedBlanks
    .map((blank) => {
      const answer = blanks[blank.label]?.trim() ?? "";
      return answer.length > 0 ? `${blank.label}: ${answer}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export type SubmittedAnswerDisplayItem = {
  key: string;
  label?: string;
  text: string;
};

const SUBMITTED_SHORT_ANSWER_LINE_RE = /^([^:\n]{1,8})\s*:\s*(.*)$/u;

export function getSubmittedAnswerDisplayItems(
  questionNo: QuestionNo,
  answerText: string,
): SubmittedAnswerDisplayItem[] {
  if (!answerText.trim()) return [];

  if (!isShortAnswer(questionNo)) {
    return [{ key: "answer", text: answerText }];
  }

  const lines = answerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const labeledItems = lines.reduce<SubmittedAnswerDisplayItem[]>(
    (items, line) => {
      const match = SUBMITTED_SHORT_ANSWER_LINE_RE.exec(line);
      if (!match) return items;
      const label = match[1].trim();
      const text = match[2].trim();
      if (!label || !text) return items;
      items.push({ key: label, label, text });
      return items;
    },
    [],
  );

  if (labeledItems.length > 0 && labeledItems.length === lines.length) {
    return labeledItems;
  }

  return [{ key: "answer", text: answerText }];
}

export function count51AnswerChars(blanks: Record<string, string>): number {
  return Object.values(blanks).reduce(
    (total, answer) => total + answer.trim().length,
    0,
  );
}

export type ShortAnswerQuestion52Json = {
  _v: "52.v1";
  blanks: Record<string, string>;
};

export function isShortAnswer52DraftJson(
  value: unknown,
): value is ShortAnswerQuestion52Json {
  if (!isStringRecord(value)) return false;
  if (value._v !== "52.v1") return false;
  if (!isStringRecord(value.blanks)) return false;
  return Object.values(value.blanks).every((item) => typeof item === "string");
}

// Q52(단락 완성)도 Q51과 동일한 빈칸(ㄱ/ㄴ) 구조 → 답안 빌드/글자수 로직을 그대로 재사용한다.
export const build52AnswerText = build51AnswerText;
export const count52AnswerChars = count51AnswerChars;

export function isLongFormDraftJson(value: unknown): value is LongFormDraftJson {
  if (!isStringRecord(value)) return false;
  if (value._v === "53.v1") {
    const sections = value.sections;
    if (!isStringRecord(sections)) return false;
    return (
      typeof sections.intro === "string" &&
      typeof sections.body === "string" &&
      typeof sections.conclusion === "string"
    );
  }
  if (value._v === "54.v1") {
    if (typeof value.text !== "string") return false;
    const checklist = value.checklist;
    if (!isStringRecord(checklist)) return false;
    return ESSAY_CHECKLIST_KEYS.every((k) => {
      const status = checklist[k];
      return (
        typeof status === "string" &&
        (ALLOWED_STATUS as readonly string[]).includes(status)
      );
    });
  }
  return false;
}
