import { describe, expect, it } from "vitest";
import { groupSentenceFeedbackRows } from "../../../src/lib/writing/sentence-feedback-grouping";
import type { SentenceFeedbackRow } from "../../../src/lib/writing/types";

function row(
  id: string,
  originalText: string | null,
  overrides: Partial<SentenceFeedbackRow> = {},
): SentenceFeedbackRow {
  return {
    id,
    submission_id: "sub-1",
    user_id: "user-1",
    sentence_index: 0,
    original_text: originalText,
    corrected_text: "고침",
    comment: "설명",
    ...overrides,
  } as SentenceFeedbackRow;
}

describe("groupSentenceFeedbackRows — short (51/52)", () => {
  const answerText = "ㄱ: 신청할 수 있습니까\nㄴ: 알려 주시면 좋겠습니다";

  it("buckets rows into the blanks whose answer line contains the original text", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [
        row("s-1", "신청할 수"),
        row("s-2", "알려 주시면"),
      ],
      questionNo: 51,
      answerText,
      answerJson: null,
    });

    expect(groups.map((g) => [g.kind, g.blankLabel, g.rows.length])).toEqual([
      ["blank", "ㄱ", 1],
      ["blank", "ㄴ", 1],
    ]);
  });

  it("buckets the literal blank marker annotation (e.g. 'ㄴ:') into its blank", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "ㄴ:")],
      questionNo: 52,
      answerText,
      answerJson: null,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("blank");
    expect(groups[0].blankLabel).toBe("ㄴ");
  });

  it("puts empty and unmatched originals into the general group", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", ""), row("s-2", null), row("s-3", "완전히 다른 텍스트")],
      questionNo: 51,
      answerText,
      answerJson: null,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("general");
    expect(groups[0].rows.map((r) => r.id)).toEqual(["s-1", "s-2", "s-3"]);
  });

  it("prefers the first blank when both answers contain the same text", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "sdfdsf")],
      questionNo: 51,
      answerText: "ㄱ: sdfdsf\nㄴ: sdfdsf",
      answerJson: null,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].blankLabel).toBe("ㄱ");
  });

  it("falls back to general when the answer has no labeled blank lines", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "저는 회의 일정 때문에")],
      questionNo: 51,
      answerText: "저는 회의 일정 때문에 금요일에 만날 수 있습니다.",
      answerJson: null,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("general");
  });

  it("matches across whitespace differences", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "신청할  수   있습니까")],
      questionNo: 51,
      answerText,
      answerJson: null,
    });

    expect(groups[0].blankLabel).toBe("ㄱ");
  });
});

describe("groupSentenceFeedbackRows — long 53 (answer_json sections)", () => {
  const answerJson = {
    _v: "53.v1",
    sections: {
      intro: "자료에서 가장 큰 변화는 방문자 수 증가입니다.",
      body: "온라인 신청 비율이 빠르게 높아졌습니다. 모바일 안내를 강화해야 합니다.",
      conclusion: "두 방식의 균형을 맞추는 것이 중요합니다.",
    },
  };

  it("buckets rows into intro/body/conclusion by section containment, one group per section", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [
        row("s-1", "방문자 수 증가"),
        row("s-2", "온라인 신청 비율"),
        row("s-3", "모바일 안내를 강화해야"),
        row("s-4", "균형을 맞추는 것"),
      ],
      questionNo: 53,
      answerText: null,
      answerJson,
    });

    expect(groups.map((g) => [g.kind, g.rows.length])).toEqual([
      ["intro", 1],
      ["body", 2],
      ["conclusion", 1],
    ]);
  });

  it("sends document-level annotations (empty original) to the general group", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "방문자 수 증가"), row("s-2", "")],
      questionNo: 53,
      answerText: null,
      answerJson,
    });

    expect(groups.map((g) => g.kind)).toEqual(["intro", "general"]);
  });

  it("omits sections that received no annotations", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "균형을 맞추는 것")],
      questionNo: 53,
      answerText: null,
      answerJson,
    });

    expect(groups.map((g) => g.kind)).toEqual(["conclusion"]);
  });
});

describe("groupSentenceFeedbackRows — long 54 (paragraph anchoring)", () => {
  it("anchors first/middle/last paragraphs to intro/body/conclusion", () => {
    const answerText = [
      "온라인 수업은 시간과 장소의 제약이 적습니다.",
      "하지만 집중력이 떨어질 수 있습니다.\n또한 실습이 어렵습니다.",
      "그러므로 상황에 맞게 병행하는 것이 좋습니다.",
    ].join("\n\n");

    const groups = groupSentenceFeedbackRows({
      rows: [
        row("s-1", "시간과 장소의 제약"),
        row("s-2", "집중력이 떨어질"),
        row("s-3", "병행하는 것이 좋습니다"),
      ],
      questionNo: 54,
      answerText,
      answerJson: null,
    });

    expect(groups.map((g) => g.kind)).toEqual(["intro", "body", "conclusion"]);
  });

  it("reads paragraphs from 54.v1 answer_json text when present", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "첫 문단 내용")],
      questionNo: 54,
      answerText: null,
      answerJson: {
        _v: "54.v1",
        text: "첫 문단 내용입니다.\n\n마지막 문단 내용입니다.",
        checklist: {
          intro: "unchecked",
          body: "unchecked",
          conclusion: "unchecked",
          evidence: "unchecked",
          connectors: "unchecked",
          topic_fit: "unchecked",
        },
      },
    });

    expect(groups.map((g) => g.kind)).toEqual(["intro"]);
  });

  it("treats a two-paragraph answer as intro + conclusion", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "첫 문단"), row("s-2", "둘째 문단")],
      questionNo: 54,
      answerText: "첫 문단입니다.\n\n둘째 문단입니다.",
      answerJson: null,
    });

    expect(groups.map((g) => g.kind)).toEqual(["intro", "conclusion"]);
  });

  it("does not invent sections for a single-paragraph answer", () => {
    const groups = groupSentenceFeedbackRows({
      rows: [row("s-1", "한 줄짜리 답안")],
      questionNo: 54,
      answerText: "한 줄짜리 답안입니다.",
      answerJson: null,
    });

    expect(groups.map((g) => g.kind)).toEqual(["general"]);
  });
});
