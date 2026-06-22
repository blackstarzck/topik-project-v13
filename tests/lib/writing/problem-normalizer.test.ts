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

  it("normalizes 51 blanks without exposing accepted answers to the client", () => {
    const normalized = normalizeWritingProblem(
      inputFromFixture(record(sample51[0]), 51),
    );

    expect(normalized.kind).toBe("q51");
    if (normalized.kind !== "q51") throw new Error("expected q51");
    expect(normalized.blanks).toHaveLength(2);
    expect(normalized.blanks[0].key).toBe("ㄱ");
    // 정답 목록은 클라이언트로 전달되는 NormalizedBlank에 포함되지 않는다.
    expect(normalized.blanks[0]).not.toHaveProperty("acceptedAnswers");
    const serialized = JSON.stringify(normalized.blanks);
    expect(serialized).not.toContain("잘 수 없습니다");
    expect(normalized.answerMode).toBe("single_text");
    expect(normalized.charLimit.hardMax).toBe(120);
  });

  it("does not expose blank_target_* authoring memo as a learner hint (answer leak guard)", () => {
    // blank_target_giyeok/nieun은 원문 정답 구간을 그대로 담은 검수 메모다.
    // 학습자 풀이 화면 힌트(targetHint)로 노출되면 정답이 새어 나간다.
    const normalized = normalizeWritingProblem({
      id: "q51-blank-target-leak",
      title: "leak guard",
      prompt: "지문 ( ㄱ ) 그리고 ( ㄴ ) 으로 이어진다.",
      questionNo: 51,
      materials: {
        blanks: {
          blank_target_giyeok:
            "ㄱ: 8행에서 '참가하고 싶으신 분들은' 구간 전체를 빈칸으로 지정",
          blank_target_nieun:
            "ㄴ: 9행에서 '문의해 주시기를 바랍니다' 구간 전체를 빈칸으로 지정",
        },
      },
      answerKey: {},
      rubric: {},
      lifecycleStatus: "active",
    });

    expect(normalized.kind).toBe("q51");
    if (normalized.kind !== "q51") throw new Error("expected q51");
    // blank_target_*는 빈칸 존재 신호로만 쓰여 빈칸 2개는 정상 생성되어야 한다.
    expect(normalized.blanks).toHaveLength(2);
    for (const blank of normalized.blanks) {
      expect(blank.targetHint).toBeNull();
    }
    const serialized = JSON.stringify(normalized.blanks);
    expect(serialized).not.toContain("구간 전체를 빈칸으로 지정");
    expect(serialized).not.toContain("참가하고 싶으신 분들은");
  });

  it("promotes the writing fixture text_type into textType", () => {
    const normalized = normalizeWritingProblem({
      id: "q51-text-type",
      title: "Gym survey",
      prompt: "Prompt ( ㄱ ) ( ㄴ )",
      questionNo: 51,
      materials: { meta: { text_type: "Survey notice" } },
      answerKey: {},
      rubric: {},
      lifecycleStatus: "active",
    });

    expect(normalized.textType).toBe("Survey notice");
  });

  it("promotes the normalized taxonomy text_type into textType", () => {
    const normalized = normalizeWritingProblem({
      id: "q51-taxonomy-text-type",
      title: "Gym survey",
      prompt: "Prompt ( ㄱ ) ( ㄴ )",
      questionNo: 51,
      materials: { taxonomy: { text_type: "Inquiry email" } },
      answerKey: {},
      rubric: {},
      lifecycleStatus: "active",
    });

    expect(normalized.textType).toBe("Inquiry email");
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
    expect(normalized.materialCards).toHaveLength(3);
    expect(normalized.materialCards[0]).toMatchObject({
      id: "chart_a",
      kind: "chart",
      title: normalized.charts[0].title,
    });
    expect(normalized.materialCards[1]).toMatchObject({
      id: "chart_b",
      kind: "chart",
      title: normalized.charts[1].title,
    });
    const referenceCard = normalized.materialCards[2];
    expect(referenceCard).toBeDefined();
    if (!referenceCard) throw new Error("expected reference card");
    expect(referenceCard.kind).toBe("reference");
    if (referenceCard.kind !== "reference") {
      throw new Error("expected reference card");
    }
    expect(referenceCard.rows.length).toBeGreaterThan(0);
    expect(normalized.writingTasks).toHaveLength(3);
    expect(normalized.rubricCriteria.length).toBeGreaterThan(0);
  });

  it("normalizes 53 material cards without exposing answer-only fields", () => {
    const normalized = normalizeWritingProblem({
      id: "q53-leak-guard",
      title: "q53",
      prompt: "1) a\n2) b\n3) c",
      questionNo: 53,
      materials: {
        charts: {
          chart_a: {
            title: "bar chart",
            chart_type: "bar",
            series: [{ label: "A", values: [1, 2] }],
          },
          chart_b: {
            title: "donut chart",
            chart_type: "donut",
            series: [{ label: "B", values: [3] }],
          },
        },
        context_notes: {
          display_label: "참고",
          row1_label: "원인",
          row1_value: "safe cause",
          row2_label: "현황",
          row2_value: "safe status",
        },
        model_answer: "must not leak",
        narrative: {
          cause_sentence: "must not leak either",
          solution_sentence: "must not leak solution",
        },
        scenario_logic: {
          shared_context: "must not leak context",
        },
      },
      answerKey: { model_answer: "must not leak answer key" },
      rubric: {},
      lifecycleStatus: "active",
    });

    expect(normalized.kind).toBe("q53");
    if (normalized.kind !== "q53") throw new Error("expected q53");
    expect(normalized.materialCards).toHaveLength(3);
    expect(normalized.materialCards.map((card) => card.kind)).toEqual([
      "chart",
      "chart",
      "reference",
    ]);
    expect(normalized.materialCards[1].chart?.chartType).toBe("donut");
    const serialized = JSON.stringify(normalized.materialCards);
    expect(serialized).toContain("safe cause");
    expect(serialized).not.toContain("must not leak");
  });

  it("caps 53 material cards at three cards", () => {
    const normalized = normalizeWritingProblem({
      id: "q53-cap",
      title: "q53",
      prompt: "1) a\n2) b\n3) c",
      questionNo: 53,
      materials: {
        charts: {
          chart_a: {
            title: "chart a",
            chart_type: "line",
            series: [{ label: "A", values: [1, 2] }],
          },
          chart_b: {
            title: "chart b",
            chart_type: "pie",
            series: [{ label: "B", values: [3] }],
          },
          chart_c: {
            title: "chart c",
            chart_type: "bar",
            series: [{ label: "C", values: [4] }],
          },
        },
        context_notes: {
          display_label: "참고",
          row1_label: "메모",
          row1_value: "third card",
        },
      },
      rubric: {},
      lifecycleStatus: "active",
    });

    expect(normalized.kind).toBe("q53");
    if (normalized.kind !== "q53") throw new Error("expected q53");
    expect(normalized.materialCards).toHaveLength(3);
    expect(normalized.materialCards.map((card) => card.id)).toEqual([
      "chart_a",
      "chart_b",
      "context_notes",
    ]);
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

  it("normalizes 54 essay guidance metadata for the writing structure panel", () => {
    const normalized = normalizeWritingProblem({
      id: "q54-guidance",
      title: "알고리즘 추천 서비스",
      prompt:
        "다음을 주제로 하여 자신의 생각을 600~700자로 쓰시오.\n\n1) 알고리즘 추천 서비스는 어떤 편리함을 제공하는가?\n2) 지나치게 의존할 경우 어떤 문제가 발생할 수 있는가?\n3) 어떻게 하면 적절하게 활용할 수 있는가?",
      questionNo: 54,
      materials: {
        required_structure: [
          {
            title: "서론",
            description:
              "주제에 대한 자신의 의견을 명확히 밝히고 글의 방향을 제시하세요.",
            required: true,
          },
          {
            title: "본론",
            description:
              "의견을 뒷받침하는 구체적 이유나 사례를 2가지 이상 제시하세요.",
            required: true,
            items: ["본론 1: 첫 번째 근거/사례", "본론 2: 두 번째 근거/사례"],
          },
          {
            title: "결론",
            description:
              "앞서 제시한 내용을 요약하고 자신의 의견을 다시 강조하세요.",
            required: true,
          },
        ],
        required_reason_count: 2,
        reasoning_pattern: "주장→근거",
        scoring_focus: ["의견 제시", "구체적 근거", "문장 연결", "분량"],
        prohibited_elements: ["주제 이탈"],
        model_outline: {
          intro: "입장 제시",
          body: ["첫 번째 근거", "두 번째 근거"],
          conclusion: "입장 재강조",
        },
      },
      rubric: { criteria: ["내용", "구성", "언어"] },
      lifecycleStatus: "active",
    });

    expect(normalized.kind).toBe("q54");
    if (normalized.kind !== "q54") throw new Error("expected q54");
    const guidance = (
      normalized as typeof normalized & {
        essayGuidance?: {
          structure: Array<{
            title: string;
            description: string | null;
            items: string[];
            required: boolean;
          }>;
          reasonCount: number | null;
          reasoningPattern: string | null;
          scoringFocus: string[];
          prohibitedElements: string[];
          modelOutline: Array<{ title: string; items: string[] }>;
        };
      }
    ).essayGuidance;

    expect(guidance).toBeDefined();
    expect(guidance?.structure.map((section) => section.title)).toEqual([
      "서론",
      "본론",
      "결론",
    ]);
    expect(guidance?.structure[1].items).toEqual([
      "본론 1: 첫 번째 근거/사례",
      "본론 2: 두 번째 근거/사례",
    ]);
    expect(guidance?.reasonCount).toBe(2);
    expect(guidance?.reasoningPattern).toBe("주장→근거");
    expect(guidance?.scoringFocus).toEqual([
      "의견 제시",
      "구체적 근거",
      "문장 연결",
      "분량",
    ]);
    expect(guidance?.prohibitedElements).toEqual(["주제 이탈"]);
    expect(guidance?.modelOutline[0].items).toContain("입장 제시");
  });

  it("preserves up to five 54 rubric conditions for the D-04 condition panel", () => {
    const normalized = normalizeWritingProblem({
      ...inputFromFixture(record(sample54[0]), 54),
      rubric: {
        conditions: [
          "조건 1",
          "조건 2",
          "조건 3",
          "조건 4",
          "조건 5",
          "조건 6",
        ],
        criteria: ["내용", "구성", "언어"],
      },
    });

    expect(normalized.kind).toBe("q54");
    expect(normalized.rubric.conditions).toEqual([
      "조건 1",
      "조건 2",
      "조건 3",
      "조건 4",
      "조건 5",
    ]);
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
    [
      "null materials/rubric/answerKey",
      { materials: null, rubric: null, answerKey: null },
    ],
    [
      "chart_a as array",
      { materials: { charts: { chart_a: [1, 2, 3], chart_b: null } } },
    ],
    ["answer_key as array", { answerKey: ["x", "y"] }],
    [
      "answer_key[label] non-string",
      { answerKey: { ["ㄱ"]: 42, ["ㄴ"]: { nested: true } } },
    ],
    [
      "review.validation non-array",
      { materials: { review: { validation: 7 } } },
    ],
    [
      "blanks weird position",
      { materials: { blanks: { blank_1: { position: 99 }, blank_2: "nope" } } },
    ],
    [
      "chart series non-number values",
      {
        materials: {
          charts: {
            chart_a: {
              title: "t",
              series: [{ label: "a", values: ["x", null, 3] }],
            },
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
