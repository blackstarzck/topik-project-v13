import {
  isLongFormDraftJson,
  isShortAnswer,
  isQuestionNo,
  type SentenceFeedbackRow,
} from "./types";

// 문장별 첨삭 라벨은 외부 채점 API가 주지 않는다(annotations는 가변 개수의
// 인라인 첨삭 배열). 순서로 서론/본론/결론·ㄱㄴㄷㄹ을 지어 붙이는 대신,
// 첨삭 원문(original_text)을 제출 답안에 대조(anchor)해 그룹으로 묶는다.
// 실행 계약: tests/lib/writing/sentence-feedback-grouping.test.ts

export type SentenceFeedbackGroupKind =
  | "blank"
  | "intro"
  | "body"
  | "conclusion"
  | "general";

export type SentenceFeedbackGroup = {
  key: string;
  kind: SentenceFeedbackGroupKind;
  /** blank 그룹에서만: 답안에 실재하는 빈칸 표기(예: ㄱ, ㄴ). */
  blankLabel: string | null;
  rows: SentenceFeedbackRow[];
};

export type SentenceFeedbackGroupInput = {
  rows: SentenceFeedbackRow[];
  questionNo: number;
  answerText: string | null | undefined;
  answerJson: unknown;
};

// getSubmittedAnswerDisplayItems와 같은 "라벨: 답" 줄 형식 (build51AnswerText 출력).
const SHORT_ANSWER_LINE_RE = /^([^:\n]{1,8})\s*:\s*(.*)$/u;

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

type ShortAnchor = { label: string; line: string };

function shortAnchors(answerText: string): ShortAnchor[] {
  return answerText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = SHORT_ANSWER_LINE_RE.exec(line);
      if (!match) return [];
      const label = match[1].trim();
      return label ? [{ label, line: normalize(line) }] : [];
    });
}

type LongSections = { intro: string; body: string; conclusion: string };

function paragraphSections(text: string): LongSections | null {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => normalize(part))
    .filter(Boolean);
  if (paragraphs.length >= 3) {
    return {
      intro: paragraphs[0],
      body: paragraphs.slice(1, -1).join(" "),
      conclusion: paragraphs[paragraphs.length - 1],
    };
  }
  if (paragraphs.length === 2) {
    return { intro: paragraphs[0], body: "", conclusion: paragraphs[1] };
  }
  // 문단 구조가 없으면 섹션을 추측하지 않는다 — 전부 전체(general) 그룹.
  return null;
}

function longSections(input: SentenceFeedbackGroupInput): LongSections | null {
  const json = input.answerJson;
  if (json && isLongFormDraftJson(json)) {
    if (json._v === "53.v1") {
      return {
        intro: normalize(json.sections.intro),
        body: normalize(json.sections.body),
        conclusion: normalize(json.sections.conclusion),
      };
    }
    return paragraphSections(json.text);
  }
  return paragraphSections(input.answerText ?? "");
}

const LONG_SECTION_ORDER = ["intro", "body", "conclusion"] as const;

export function groupSentenceFeedbackRows(
  input: SentenceFeedbackGroupInput,
): SentenceFeedbackGroup[] {
  const short =
    isQuestionNo(input.questionNo) && isShortAnswer(input.questionNo);
  return short ? groupShortRows(input) : groupLongRows(input);
}

function groupShortRows(
  input: SentenceFeedbackGroupInput,
): SentenceFeedbackGroup[] {
  const anchors = shortAnchors(input.answerText ?? "");
  const buckets = new Map<string, SentenceFeedbackRow[]>(
    anchors.map((anchor) => [anchor.label, []]),
  );
  const general: SentenceFeedbackRow[] = [];

  for (const row of input.rows) {
    const text = normalize(row.original_text);
    const anchor = text
      ? anchors.find((candidate) => candidate.line.includes(text))
      : undefined;
    if (anchor) {
      buckets.get(anchor.label)?.push(row);
    } else {
      general.push(row);
    }
  }

  const groups: SentenceFeedbackGroup[] = anchors
    .filter((anchor) => (buckets.get(anchor.label)?.length ?? 0) > 0)
    .map((anchor) => ({
      key: `blank:${anchor.label}`,
      kind: "blank" as const,
      blankLabel: anchor.label,
      rows: buckets.get(anchor.label) ?? [],
    }));
  if (general.length > 0) {
    groups.push({
      key: "general",
      kind: "general",
      blankLabel: null,
      rows: general,
    });
  }
  return groups;
}

function groupLongRows(
  input: SentenceFeedbackGroupInput,
): SentenceFeedbackGroup[] {
  const sections = longSections(input);
  const buckets: Record<
    (typeof LONG_SECTION_ORDER)[number],
    SentenceFeedbackRow[]
  > = { intro: [], body: [], conclusion: [] };
  const general: SentenceFeedbackRow[] = [];

  for (const row of input.rows) {
    const text = normalize(row.original_text);
    const section =
      text && sections
        ? LONG_SECTION_ORDER.find((key) => sections[key].includes(text))
        : undefined;
    if (section) {
      buckets[section].push(row);
    } else {
      general.push(row);
    }
  }

  const groups: SentenceFeedbackGroup[] = LONG_SECTION_ORDER.filter(
    (key) => buckets[key].length > 0,
  ).map((key) => ({
    key: `section:${key}`,
    kind: key,
    blankLabel: null,
    rows: buckets[key],
  }));
  if (general.length > 0) {
    groups.push({
      key: "general",
      kind: "general",
      blankLabel: null,
      rows: general,
    });
  }
  return groups;
}
