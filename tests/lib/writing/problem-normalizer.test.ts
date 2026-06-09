import { describe, expect, it } from "vitest";

import sample51 from "../../../docs/Wireframe/08-D-01-short-answer-writing-51/sample-51.json";
import sample52 from "../../../docs/Wireframe/09-D-02-answer-writing-52/sample-52.json";
import sample53 from "../../../docs/Wireframe/10-D-03-long-form-writing-53/sample-53.json";
import sample54 from "../../../docs/Wireframe/11-D-04-essay-writing-54/sample-54.json";
import sample542 from "../../../docs/Wireframe/11-D-04-essay-writing-54/sample-54-2.json";
import {
  normalizeWritingProblem,
  type WritingProblemNormalizerInput,
} from "../../../src/lib/writing/problem-normalizer";
import type { QuestionNo } from "../../../src/lib/writing/types";
import { CHAR_LIMITS } from "../../../src/lib/writing/constants";

type FixtureRecord = Record<string, unknown>;

function record(value: unknown): FixtureRecord {
  return value as FixtureRecord;
}

function nested(value: unknown, key: string): FixtureRecord | null {
  const parent = record(value);
  const child = parent[key];
  return child && typeof child === "object" && !Array.isArray(child)
    ? record(child)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function titleFrom(item: FixtureRecord): string {
  return (
    str(item.topic_seed_title) ??
    str(nested(item, "approved_topic_seed")?.topic_seed_title) ??
    str(nested(item, "scenario_logic")?.scenario_title) ??
    str(nested(item, "meta")?.scenario_type) ??
    "fixture problem"
  );
}

function inputFromFixture(
  item: FixtureRecord,
  questionNo: QuestionNo,
): WritingProblemNormalizerInput {
  return {
    id: str(item.id) ?? `${questionNo}-fixture`,
    title: titleFrom(item),
    prompt: str(item.prompt_text) ?? "",
    questionNo,
    materials: item,
    answerKey: item.answer_key,
    rubric: item.rubric ?? item.approved_rubric,
    lifecycleStatus: "active",
  };
}

describe("normalizeWritingProblem", () => {
  it("smoke-normalizes every 08~11 wireframe fixture", () => {
    const all: Array<[QuestionNo, FixtureRecord[]]> = [
      [51, sample51 as FixtureRecord[]],
      [52, sample52 as FixtureRecord[]],
      [53, sample53 as FixtureRecord[]],
      [54, sample54 as FixtureRecord[]],
      [54, sample542 as FixtureRecord[]],
    ];

    let count = 0;
    for (const [questionNo, items] of all) {
      for (const item of items) {
        const normalized = normalizeWritingProblem(
          inputFromFixture(item, questionNo),
        );
        expect(normalized.id).toBeTruthy();
        expect(normalized.questionNo).toBe(questionNo);
        expect(normalized.prompt.length).toBeGreaterThan(0);
        expect(normalized.lifecycleStatus).toBe("active");
        count += 1;
      }
    }
    expect(count).toBe(466);
  });

  it("normalizes 51 blank answers from accepted-answer fixtures", () => {
    const normalized = normalizeWritingProblem(
      inputFromFixture(record(sample51[0]), 51),
    );

    expect(normalized.kind).toBe("q51");
    if (normalized.kind !== "q51") throw new Error("expected q51");
    expect(normalized.blanks).toHaveLength(2);
    expect(normalized.blanks[0].key).toBe("ㄱ");
    expect(normalized.blanks[0].acceptedAnswers).toContain("잘 수 없습니다");
    expect(normalized.answerMode).toBe("single_text");
    expect(normalized.charLimit.hardMax).toBe(120);
  });

  it("normalizes seeded 53 chart/material shape", () => {
    const item = record(sample53[0]);
    const normalized = normalizeWritingProblem({
      id: str(item.id) ?? "q53",
      title: titleFrom(item),
      prompt: str(item.prompt_text) ?? "",
      questionNo: 53,
      materials: {
        charts: {
          chart_a: item.chart_a,
          chart_b: item.chart_b,
        },
        context_notes: item.context_notes,
        scenario: item.scenario_logic,
      },
      rubric: {
        rubric: item.rubric,
        approved_rubric: item.approved_rubric,
      },
      lifecycleStatus: "active",
    });

    expect(normalized.kind).toBe("q53");
    if (normalized.kind !== "q53") throw new Error("expected q53");
    expect(normalized.charts).toHaveLength(2);
    expect(normalized.charts[0].chartType).toBe("bar");
    expect(normalized.referenceMaterials.some((m) => m.kind === "chart")).toBe(
      true,
    );
    expect(normalized.writingTasks).toHaveLength(3);
    expect(normalized.rubricCriteria.length).toBeGreaterThan(0);
  });

  it("splits 54 essay prompt into topic, required questions, and rubric", () => {
    const normalized = normalizeWritingProblem(
      inputFromFixture(record(sample54[0]), 54),
    );

    expect(normalized.kind).toBe("q54");
    if (normalized.kind !== "q54") throw new Error("expected q54");
    expect(normalized.topicTitle).toBe("디지털 시민성");
    expect(normalized.requiredQuestions).toHaveLength(3);
    expect(normalized.rubricSummary.content).toContain("세 가지 과제");
    expect(normalized.submitBlockedReason).toBeNull();
  });

  it("returns explicit fallback and submit block for incomplete 54 data", () => {
    const normalized = normalizeWritingProblem({
      id: "broken-54",
      title: "깨진 54번",
      prompt: "다음을 주제로 하여 자신의 생각을 쓰시오.",
      questionNo: 54,
      materials: {},
      rubric: null,
      lifecycleStatus: "active",
    });

    expect(normalized.kind).toBe("q54");
    expect(normalized.fallbackWarnings).toContain("missing_required_questions");
    expect(normalized.fallbackWarnings).toContain("missing_rubric");
    expect(normalized.submitBlockedReason).toBe("problem_data_incomplete");
  });
});

describe("normalizeWritingProblem — adversarial / malformed inputs (A2 hardening)", () => {
  const malformed: Array<[string, Partial<WritingProblemNormalizerInput>]> = [
    ["bare-array rubric", { rubric: ["조건 A", "조건 B", "기준 1"] }],
    ["string materials", { materials: '{"unparsed":true}' }],
    ["null materials/rubric/answerKey", { materials: null, rubric: null, answerKey: null }],
    ["chart_a as array", { materials: { charts: { chart_a: [1, 2, 3], chart_b: null } } }],
    ["answer_key as array", { answerKey: ["x", "y"] }],
    ["answer_key[label] non-string", { answerKey: { ["ㄱ"]: 42, ["ㄴ"]: { nested: true } } }],
    ["review.validation non-array", { materials: { review: { validation: 7 } } }],
    [
      "blanks weird position",
      { materials: { blanks: { blank_1: { position: 99 }, blank_2: "nope" } } },
    ],
    [
      "chart series non-number values",
      {
        materials: {
          charts: {
            chart_a: { title: "t", series: [{ label: "a", values: ["x", null, 3] }] },
          },
        },
      },
    ],
    ["empty prompt", { prompt: "" }],
  ];

  for (const qno of [51, 52, 53, 54] as QuestionNo[]) {
    for (const [name, override] of malformed) {
      it(`q${qno}: ${name} → no throw, graceful fallback`, () => {
        const run = () =>
          normalizeWritingProblem({
            id: `q${qno}-adv`,
            title: "t",
            prompt: "지문 ( ㄱ ) ( ㄴ ) 1) 가 2) 나 3) 다 200~300자로 쓰시오",
            questionNo: qno,
            materials: {},
            lifecycleStatus: "active",
            ...override,
          } as WritingProblemNormalizerInput);
        expect(run).not.toThrow();
        const n = run();
        expect(n.questionNo).toBe(qno);
        expect([null, "lifecycle", "problem_data_incomplete"]).toContain(
          n.submitBlockedReason,
        );
      });
    }
  }

  it("bare-array rubric populates BOTH conditions and criteria (q52 not falsely blocked)", () => {
    const n = normalizeWritingProblem({
      id: "q52-arr",
      title: "t",
      prompt: "지문 ( ㄱ ) 무엇 ( ㄴ ) 어떻게",
      questionNo: 52,
      materials: {},
      rubric: ["조건1", "조건2"],
      lifecycleStatus: "active",
    });
    if (n.kind !== "q52") throw new Error("expected q52");
    expect(n.rubric.conditions.length).toBeGreaterThan(0);
    expect(n.rubric.criteria.length).toBeGreaterThan(0);
    expect(n.submitBlockedReason).toBeNull();
  });
});

describe("normalizeWritingProblem — submit-block on unanswerable data (A2, user-facing)", () => {
  it("q51 with zero blanks → problem_data_incomplete", () => {
    const n = normalizeWritingProblem({
      id: "q51-noblank",
      title: "t",
      prompt: "빈칸 마커가 전혀 없는 지문입니다.",
      questionNo: 51,
      materials: {},
      answerKey: {},
      lifecycleStatus: "active",
    });
    expect(n.kind).toBe("q51");
    expect(n.fallbackWarnings).toContain("missing_blanks");
    expect(n.submitBlockedReason).toBe("problem_data_incomplete");
  });

  it("q53 with no charts AND no tasks → problem_data_incomplete", () => {
    const n = normalizeWritingProblem({
      id: "q53-empty",
      title: "t",
      prompt: "차트도 번호 과제도 없는 지문.",
      questionNo: 53,
      materials: {},
      lifecycleStatus: "active",
    });
    expect(n.kind).toBe("q53");
    expect(n.submitBlockedReason).toBe("problem_data_incomplete");
  });

  it("q53 with charts but no tasks → NOT blocked", () => {
    const n = normalizeWritingProblem({
      id: "q53-chartonly",
      title: "t",
      prompt: "번호 과제 없는 지문.",
      questionNo: 53,
      materials: {
        charts: {
          chart_a: {
            title: "차트",
            chart_type: "bar",
            series: [{ label: "a", values: [1, 2] }],
          },
        },
      },
      lifecycleStatus: "active",
    });
    expect(n.kind).toBe("q53");
    expect(n.submitBlockedReason).toBeNull();
  });
});

describe("char-limit ↔ prompt range drift guard (A2 / G8)", () => {
  it("53 prompt-embedded range equals CHAR_LIMITS[53] recommended", () => {
    const limit = CHAR_LIMITS[53];
    const range = `${limit.recommendedMin}~${limit.recommendedMax}`;
    for (const item of sample53 as FixtureRecord[]) {
      const prompt = (item as Record<string, unknown>).prompt_text;
      if (typeof prompt === "string") expect(prompt).toContain(range);
    }
  });

  it("54 prompt-embedded range equals CHAR_LIMITS[54] recommended", () => {
    const limit = CHAR_LIMITS[54];
    const range = `${limit.recommendedMin}~${limit.recommendedMax}`;
    for (const item of sample54 as FixtureRecord[]) {
      const prompt = (item as Record<string, unknown>).prompt_text;
      if (typeof prompt === "string") expect(prompt).toContain(range);
    }
  });
});
