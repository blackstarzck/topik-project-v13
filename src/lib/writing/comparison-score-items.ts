import type { Json } from "../supabase/types";
import {
  FEEDBACK_DIMENSIONS,
  isShortAnswer,
  type FeedbackBundle,
  type FeedbackDimensionScoreRow,
  type QuestionNo,
  type WritingSubmissionRow,
} from "./types";

export const BLANK_COMPARISON_KEYS = ["blank_1", "blank_2"] as const;

export type BlankComparisonKey = (typeof BLANK_COMPARISON_KEYS)[number];
export type ComparisonScoreKind = "blank" | "dimension";

export type ComparisonScoreItem = {
  key: string;
  kind: ComparisonScoreKind;
  normalizedScore: number | null;
  rawScore: number | null;
  scoreMax: number | null;
  summary: string | null;
  strengths: string[];
  improvements: string[];
};

export type ComparisonMetricScoreItem = {
  key: string;
  score: number | null;
  scoreMax: number | null;
};

export type BlankComparisonDatum = {
  key: BlankComparisonKey;
  current: ComparisonScoreItem | null;
  previous: ComparisonScoreItem | null;
  delta: number | null;
  rawDelta: number | null;
  currentAnswer: string | null;
  previousAnswer: string | null;
};

type SubmissionAnswerSource = Pick<
  WritingSubmissionRow,
  "question_no" | "answer_text" | "answer_json"
>;

const BLANK_ANSWER_ALIASES: Record<BlankComparisonKey, readonly string[]> = {
  blank_1: ["blank_1", "ㄱ", "㉠", "1"],
  blank_2: ["blank_2", "ㄴ", "㉡", "2"],
};

export function buildComparisonScoreItems(
  questionNo: QuestionNo,
  bundle: FeedbackBundle | null,
): ComparisonScoreItem[] {
  if (!bundle) return [];

  if (isShortAnswer(questionNo)) {
    const blankItems = readBlankTraitScoreItems(bundle.feedback.raw_ai_result);
    if (blankItems.length > 0) return blankItems;
  }

  return readDimensionScoreItems(bundle.dimensions);
}

export function toComparisonMetricScoreItems(
  items: ComparisonScoreItem[],
): ComparisonMetricScoreItem[] {
  return items.map((item) => ({
    key: item.key,
    score: item.normalizedScore,
    scoreMax: 100,
  }));
}

export function scoreItemMap(
  items: ComparisonScoreItem[],
): Record<string, number | null> {
  return Object.fromEntries(
    items.map((item) => [item.key, item.normalizedScore]),
  );
}

export function hasBlankScoreItems(items: ComparisonScoreItem[]): boolean {
  return items.some((item) => item.kind === "blank");
}

export function buildBlankComparisonData({
  currentItems,
  previousItems,
  currentSubmission,
  previousSubmission,
}: {
  currentItems: ComparisonScoreItem[];
  previousItems: ComparisonScoreItem[];
  currentSubmission: SubmissionAnswerSource;
  previousSubmission: SubmissionAnswerSource | null;
}): BlankComparisonDatum[] {
  const currentByKey = new Map(currentItems.map((item) => [item.key, item]));
  const previousByKey = new Map(previousItems.map((item) => [item.key, item]));
  const currentAnswers = extractBlankAnswerMap(currentSubmission);
  const previousAnswers = previousSubmission
    ? extractBlankAnswerMap(previousSubmission)
    : emptyBlankAnswerMap();

  return BLANK_COMPARISON_KEYS.map((key) => {
    const current = currentByKey.get(key) ?? null;
    const previous = previousByKey.get(key) ?? null;
    return {
      key,
      current,
      previous,
      delta:
        current?.normalizedScore !== null &&
        current?.normalizedScore !== undefined &&
        previous?.normalizedScore !== null &&
        previous?.normalizedScore !== undefined
          ? round1(current.normalizedScore - previous.normalizedScore)
          : null,
      rawDelta:
        current?.rawScore !== null &&
        current?.rawScore !== undefined &&
        previous?.rawScore !== null &&
        previous?.rawScore !== undefined
          ? round1(current.rawScore - previous.rawScore)
          : null,
      currentAnswer: currentAnswers[key],
      previousAnswer: previousAnswers[key],
    };
  });
}

function readBlankTraitScoreItems(
  rawValue: Json | null,
): ComparisonScoreItem[] {
  const raw = asRecord(rawValue);
  const traits = raw?.trait_scores;
  if (!Array.isArray(traits)) return [];

  const byKey = new Map<BlankComparisonKey, ComparisonScoreItem>();
  for (const entry of traits) {
    const record = asRecord(entry);
    if (!record) continue;

    const trait = readString(record.trait) ?? readString(record.name);
    if (!isBlankComparisonKey(trait)) continue;

    const rawScore = readNumber(record.score);
    const scoreMax = readPositiveNumber(record.max_score);
    byKey.set(trait, {
      key: trait,
      kind: "blank",
      normalizedScore: normalizeScore(rawScore, scoreMax),
      rawScore,
      scoreMax,
      summary: readString(record.feedback) ?? readString(record.comment),
      strengths: readStringArray(record.strengths),
      improvements: readStringArray(record.improvements),
    });
  }

  return BLANK_COMPARISON_KEYS.flatMap((key) => {
    const item = byKey.get(key);
    return item ? [item] : [];
  });
}

function readDimensionScoreItems(
  dimensions: FeedbackDimensionScoreRow[],
): ComparisonScoreItem[] {
  return dimensions
    .filter((row) =>
      (FEEDBACK_DIMENSIONS as readonly string[]).includes(row.dimension),
    )
    .map((row) => ({
      key: row.dimension,
      kind: "dimension" as const,
      normalizedScore: normalizeScore(row.score, row.score_max),
      rawScore: row.score,
      scoreMax: row.score_max,
      summary: row.summary,
      strengths: [],
      improvements: [],
    }));
}

function extractBlankAnswerMap(
  submission: SubmissionAnswerSource,
): Record<BlankComparisonKey, string | null> {
  const fromJson = extractBlankAnswerMapFromJson(submission.answer_json);
  if (fromJson) return fromJson;

  const answers = emptyBlankAnswerMap();
  const lines = submission.answer_text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = /^([^:\n]{1,8})\s*:\s*(.*)$/u.exec(line);
    if (!match) continue;
    const label = match[1].trim();
    const text = match[2].trim();
    if (!text) continue;
    const key = blankKeyFromAnswerLabel(label);
    if (key) answers[key] = text;
  }

  return answers;
}

function extractBlankAnswerMapFromJson(
  answerJson: Json | null,
): Record<BlankComparisonKey, string | null> | null {
  const record = asRecord(answerJson);
  const blanks = asRecord(record?.blanks);
  if (!blanks) return null;

  const answers = emptyBlankAnswerMap();
  let hasAnswer = false;
  for (const key of BLANK_COMPARISON_KEYS) {
    for (const alias of BLANK_ANSWER_ALIASES[key]) {
      const text = readString(blanks[alias]);
      if (!text) continue;
      answers[key] = text;
      hasAnswer = true;
      break;
    }
  }
  return hasAnswer ? answers : null;
}

function emptyBlankAnswerMap(): Record<BlankComparisonKey, string | null> {
  return { blank_1: null, blank_2: null };
}

function blankKeyFromAnswerLabel(label: string): BlankComparisonKey | null {
  const normalized = label.replace(/[()\[\]\s]/g, "");
  return (
    BLANK_COMPARISON_KEYS.find((key) =>
      BLANK_ANSWER_ALIASES[key].some(
        (alias) => alias.replace(/[()\[\]\s]/g, "") === normalized,
      ),
    ) ?? null
  );
}

function isBlankComparisonKey(
  value: string | null,
): value is BlankComparisonKey {
  return (
    value !== null &&
    (BLANK_COMPARISON_KEYS as readonly string[]).includes(value)
  );
}

function normalizeScore(
  score: number | null,
  scoreMax: number | null,
): number | null {
  if (score === null || scoreMax === null) return null;
  return round1((score / scoreMax) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPositiveNumber(value: unknown): number | null {
  const number = readNumber(value);
  return number !== null && number > 0 ? number : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = readString(item);
    return text ? [text] : [];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
