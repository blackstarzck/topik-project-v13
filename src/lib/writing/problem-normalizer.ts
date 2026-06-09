import { getCharLimit } from "./constants";
import type { QuestionNo } from "./types";

type AnyRecord = Record<string, unknown>;

export type ProblemLifecycleStatus = "active" | "inactive" | "expired";

export type NormalizedRubric = {
  conditions: string[];
  criteria: string[];
};

export type NormalizedBlank = {
  key: "ㄱ" | "ㄴ" | string;
  label: string;
  role: string | null;
  answerType: string | null;
  acceptedAnswers: string[];
  targetHint: string | null;
};

export type NormalizedChart = {
  id: string;
  title: string;
  chartType: "bar" | "line" | "pie" | "donut" | "table" | "unknown";
  unit: string | null;
  surveyOrg: string | null;
  yearRange: Array<string | number>;
  series: Array<{
    label: string;
    values: number[];
  }>;
};

export type NormalizedReferenceMaterial =
  | {
      kind: "chart";
      id: string;
      title: string;
      chart: NormalizedChart;
      description: string | null;
    }
  | {
      kind: "note";
      id: string;
      title: string;
      rows: Array<{ label: string; value: string }>;
    }
  | {
      kind: "text";
      id: string;
      title: string;
      text: string;
    };

type NormalizedProblemCommon = {
  id: string;
  title: string;
  prompt: string;
  questionNo: QuestionNo;
  lifecycleStatus: ProblemLifecycleStatus;
  lifecycleReason: string | null;
  rubric: NormalizedRubric;
  referenceMaterials: NormalizedReferenceMaterial[];
  fallbackWarnings: string[];
  submitBlockedReason: "lifecycle" | "problem_data_incomplete" | null;
};

export type NormalizedWritingProblem =
  | (NormalizedProblemCommon & {
      kind: "q51";
      questionNo: 51;
      blankedPrompt: string;
      blanks: NormalizedBlank[];
      answerMode: "single_text" | "per_blank";
      charLimit: ReturnType<typeof getCharLimit>;
      validationMessages: string[];
    })
  | (NormalizedProblemCommon & {
      kind: "q52";
      questionNo: 52;
      blankedPrompt: string;
      blanks: NormalizedBlank[];
      answerMode: "single_text" | "per_blank";
      charLimit: ReturnType<typeof getCharLimit>;
      validationMessages: string[];
    })
  | (NormalizedProblemCommon & {
      kind: "q53";
      questionNo: 53;
      charts: NormalizedChart[];
      materialCards: NormalizedReferenceMaterial[];
      writingTasks: string[];
      rubricCriteria: string[];
    })
  | (NormalizedProblemCommon & {
      kind: "q54";
      questionNo: 54;
      topicTitle: string;
      topicDefinition: string | null;
      background: string | null;
      requiredQuestions: string[];
      rubricSummary: {
        content: string | null;
        structure: string | null;
        language: string | null;
      };
      checklistItems: string[];
    });

export type WritingProblemNormalizerInput = {
  id: string;
  title: string;
  prompt: string;
  questionNo: QuestionNo;
  materials: unknown;
  answerKey?: unknown;
  rubric?: unknown;
  lifecycleStatus?: ProblemLifecycleStatus | null;
  lifecycleReason?: string | null;
};

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number") return String(value);
  return null;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string" && item.trim().length > 0) {
        return [item.trim()];
      }
      if (item && typeof item === "object") {
        const obj = item as AnyRecord;
        const label =
          asString(obj.label) ?? asString(obj.name) ?? asString(obj.text);
        return label ? [label] : [];
      }
      return [];
    });
  }
  const single = asString(value);
  return single ? [single] : [];
}

function pickRecord(...values: unknown[]): AnyRecord | null {
  for (const value of values) {
    const record = asRecord(value);
    if (record) return record;
  }
  return null;
}

function getNestedRecord(record: AnyRecord | null, key: string): AnyRecord | null {
  return record ? asRecord(record[key]) : null;
}

function getNestedString(record: AnyRecord | null, key: string): string | null {
  return record ? asString(record[key]) : null;
}

function normalizeLifecycle(
  value: ProblemLifecycleStatus | null | undefined,
): ProblemLifecycleStatus {
  if (value === "inactive" || value === "expired") return value;
  return "active";
}

function extractPromptNumberedItems(prompt: string): string[] {
  const lineItems = Array.from(
    prompt.matchAll(/(?:^|\n)\s*\d\)\s*([^\n]+)/g),
    (match) => match[1]?.trim(),
  ).filter((item): item is string => Boolean(item));
  if (lineItems.length > 0) return lineItems;

  return Array.from(
    prompt.matchAll(/\d\)\s*([^?。.!]+[?？])/g),
    (match) => match[1]?.trim(),
  ).filter((item): item is string => Boolean(item));
}

function getRubricCandidate(rubric: unknown, materials: AnyRecord | null) {
  const rubricObj = asRecord(rubric);
  const materialsRubric = getNestedRecord(materials, "rubric");
  return pickRecord(
    getNestedRecord(rubricObj, "rubric"),
    getNestedRecord(rubricObj, "approved_rubric"),
    rubricObj,
    getNestedRecord(materialsRubric, "rubric"),
    getNestedRecord(materialsRubric, "approved_rubric"),
    materialsRubric,
    getNestedRecord(materials, "approved_rubric"),
  );
}

function rubricSummaryFrom(candidate: AnyRecord | null) {
  return {
    content: getNestedString(candidate, "content"),
    structure: getNestedString(candidate, "structure"),
    language: getNestedString(candidate, "language"),
  };
}

function normalizeRubric(
  rubric: unknown,
  materials: AnyRecord | null,
): NormalizedRubric {
  if (Array.isArray(rubric)) {
    const list = asStringList(rubric);
    if (list.length > 0) {
      // Bare-array rubric (degenerate shape an unvalidated admin write could
      // produce). A bare array can't distinguish conditions vs criteria, so
      // populate both — criteria-only would falsely submit-block q52, which
      // gates on rubric.conditions.
      return { conditions: list.slice(0, 4), criteria: list.slice(0, 5) };
    }
  }
  const candidate = getRubricCandidate(rubric, materials);
  if (!candidate) return { conditions: [], criteria: [] };

  const conditions = asStringList(
    candidate.conditions ?? candidate["조건"] ?? candidate.tasks,
  ).slice(0, 4);

  const listCriteria = asStringList(
    candidate.criteria ??
      candidate["평가기준"] ??
      candidate.items ??
      candidate.dimensions,
  );

  const summary = rubricSummaryFrom(candidate);
  const summaryCriteria = [
    summary.content ? `내용: ${summary.content}` : null,
    summary.structure ? `구성: ${summary.structure}` : null,
    summary.language ? `언어: ${summary.language}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    conditions,
    criteria: (listCriteria.length > 0 ? listCriteria : summaryCriteria).slice(
      0,
      5,
    ),
  };
}

function answerKeyRecord(answerKey: unknown): AnyRecord | null {
  const obj = asRecord(answerKey);
  return pickRecord(getNestedRecord(obj, "answer_key"), obj);
}

function blankFrom(record: AnyRecord | null, key: string): NormalizedBlank {
  const accepted = asStringList(record?.accepted_answers);
  const canonical = asString(record?.canonical_answer);
  return {
    key,
    label: key,
    role: asString(record?.role),
    answerType: asString(record?.answer_type),
    acceptedAnswers:
      canonical && !accepted.includes(canonical)
        ? [canonical, ...accepted]
        : accepted,
    targetHint: null,
  };
}

function extractBlanks(
  prompt: string,
  materials: AnyRecord | null,
  answerKey: unknown,
): NormalizedBlank[] {
  const source = getNestedRecord(materials, "blanks") ?? materials;
  const answerRecord = answerKeyRecord(answerKey);
  const labels = Array.from(
    new Set(
      Array.from(prompt.matchAll(/[（(]\s*([ㄱ-ㅎ])\s*[）)]/g), (match) =>
        match[1],
      ).filter((label): label is string => Boolean(label)),
    ),
  );
  const fallbackLabels =
    labels.length > 0 ||
    (!source?.blank_target_giyeok && !source?.blank_target_nieun)
      ? labels
      : ["ㄱ", "ㄴ"];

  return fallbackLabels.map((label, index) => {
    const blankKey = index === 0 ? "blank_1" : "blank_2";
    const record =
      asRecord(source?.[blankKey]) ??
      Object.values(source ?? {})
        .map(asRecord)
        .find((item) => item?.position === label) ??
      null;
    const answers = asStringList(answerRecord?.[label]);
    const blank = blankFrom(record, label);
    return {
      ...blank,
      acceptedAnswers:
        answers.length > 0 ? answers : blank.acceptedAnswers,
      targetHint:
        label === "ㄱ"
          ? asString(source?.blank_target_giyeok)
          : label === "ㄴ"
            ? asString(source?.blank_target_nieun)
            : null,
    };
  });
}

function normalizeChart(id: string, raw: unknown): NormalizedChart | null {
  const chart = asRecord(raw);
  if (!chart) return null;
  const title = asString(chart.title);
  const series = Array.isArray(chart.series)
    ? chart.series.flatMap((item) => {
        const obj = asRecord(item);
        const label = asString(obj?.label);
        const values = Array.isArray(obj?.values)
          ? obj.values.filter((v): v is number => typeof v === "number")
          : [];
        return label && values.length > 0 ? [{ label, values }] : [];
      })
    : [];
  if (!title && series.length === 0) return null;
  const chartType = asString(chart.chart_type);
  return {
    id,
    title: title ?? id,
    chartType:
      chartType === "bar" ||
      chartType === "line" ||
      chartType === "pie" ||
      chartType === "donut" ||
      chartType === "table"
        ? chartType
        : "unknown",
    unit: asString(chart.unit),
    surveyOrg: asString(chart.survey_org),
    yearRange: Array.isArray(chart.year_range)
      ? chart.year_range.filter(
          (value): value is string | number =>
            typeof value === "string" || typeof value === "number",
        )
      : [],
    series,
  };
}

function extractCharts(materials: AnyRecord | null): NormalizedChart[] {
  const charts = getNestedRecord(materials, "charts") ?? materials;
  return [
    normalizeChart("chart_a", charts?.chart_a),
    normalizeChart("chart_b", charts?.chart_b),
  ].filter((chart): chart is NormalizedChart => Boolean(chart));
}

function contextNoteRows(record: AnyRecord | null) {
  if (!record) return [];
  const pairs = [
    [record.row1_label, record.row1_value],
    [record.row2_label, record.row2_value],
    ["원인", record.cause],
    ["현황", record.status],
  ] as const;
  const seen = new Set<string>();
  return pairs.flatMap(([labelRaw, valueRaw]) => {
    const label = asString(labelRaw);
    const value = asString(valueRaw);
    const key = `${label}:${value}`;
    if (!label || !value || seen.has(key)) return [];
    seen.add(key);
    return [{ label, value }];
  });
}

function normalizeReferenceMaterials(
  materials: AnyRecord | null,
): NormalizedReferenceMaterial[] {
  const charts = extractCharts(materials).map((chart) => ({
    kind: "chart" as const,
    id: chart.id,
    title: chart.title,
    chart,
    description: null,
  }));
  const contextNotes =
    getNestedRecord(materials, "context_notes") ??
    getNestedRecord(materials, "notes");
  const rows = contextNoteRows(contextNotes);
  const noteTitle = asString(contextNotes?.display_label) ?? "자료 해설";
  const notes =
    rows.length > 0
      ? [
          {
            kind: "note" as const,
            id: "context_notes",
            title: noteTitle,
            rows,
          },
        ]
      : [];
  const sourceContext = getNestedRecord(materials, "source_context");
  const situation = asString(sourceContext?.situation_summary);
  const sourceText =
    situation && charts.length === 0
      ? [
          {
            kind: "text" as const,
            id: "source_context",
            title: "상황",
            text: situation,
          },
        ]
      : [];
  return [...charts, ...notes, ...sourceText];
}

function scenarioRecord(materials: AnyRecord | null): AnyRecord | null {
  return (
    getNestedRecord(materials, "scenario") ??
    getNestedRecord(materials, "scenario_logic") ??
    getNestedRecord(materials, "approved_topic_seed")
  );
}

function q54PromptParts(prompt: string, title: string) {
  const paragraphs = prompt
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const requiredQuestions = extractPromptNumberedItems(prompt).slice(0, 3);
  const topicDefinition =
    paragraphs.find((part) => part.includes(title) && part !== paragraphs[0]) ??
    paragraphs[1] ??
    null;
  const background =
    paragraphs.find((part) => part.includes("최근")) ??
    paragraphs.slice(2).find((part) => !part.match(/^\d\)/)) ??
    null;
  return { topicDefinition, background, requiredQuestions };
}

export function normalizeWritingProblem(
  input: WritingProblemNormalizerInput,
): NormalizedWritingProblem {
  const materials = asRecord(input.materials);
  const lifecycleStatus = normalizeLifecycle(input.lifecycleStatus);
  const fallbackWarnings: string[] = [];
  const prompt =
    input.prompt ||
    getNestedString(materials, "prompt_text") ||
    getNestedString(materials, "prompt") ||
    "";
  const referenceMaterials = normalizeReferenceMaterials(materials);
  const baseRubric = normalizeRubric(input.rubric, materials);
  const submitBlockedReason =
    lifecycleStatus === "active" ? null : ("lifecycle" as const);

  const common = {
    id: input.id,
    title: input.title,
    prompt,
    questionNo: input.questionNo,
    lifecycleStatus,
    lifecycleReason: input.lifecycleReason ?? null,
    rubric: baseRubric,
    referenceMaterials,
    fallbackWarnings,
    submitBlockedReason,
  };

  if (input.questionNo === 51 || input.questionNo === 52) {
    const blanks = extractBlanks(prompt, materials, input.answerKey);
    if (blanks.length === 0) fallbackWarnings.push("missing_blanks");
    const blankConditions = blanks
      .map((blank) => blank.targetHint ?? blank.role)
      .filter((item): item is string => Boolean(item));
    const rubric = {
      conditions:
        input.questionNo === 52 && blankConditions.length > 0
          ? blankConditions.slice(0, 4)
          : baseRubric.conditions,
      criteria: baseRubric.criteria,
    };
    const incomplete =
      (input.questionNo === 52 &&
        (rubric.conditions.length === 0 || rubric.criteria.length === 0)) ||
      (input.questionNo === 51 && blanks.length === 0);
    const nextSubmitBlockedReason: NormalizedProblemCommon["submitBlockedReason"] =
      common.submitBlockedReason ??
      (incomplete ? "problem_data_incomplete" : null);
    const shortProblemBase = {
      ...common,
      blankedPrompt: prompt,
      blanks,
      answerMode: "single_text" as const,
      charLimit: getCharLimit(input.questionNo),
      validationMessages: asStringList(
        getNestedRecord(materials, "review")?.validation,
      ),
      rubric,
      submitBlockedReason: nextSubmitBlockedReason,
    };
    if (input.questionNo === 51) {
      return {
        ...shortProblemBase,
        kind: "q51",
        questionNo: 51,
      };
    }
    return {
      ...shortProblemBase,
      kind: "q52",
      questionNo: 52,
    };
  }

  if (input.questionNo === 53) {
    const charts = extractCharts(materials);
    const tasks = extractPromptNumberedItems(prompt).slice(0, 3);
    if (charts.length === 0) fallbackWarnings.push("missing_charts");
    if (tasks.length === 0) fallbackWarnings.push("missing_writing_tasks");
    return {
      ...common,
      kind: "q53",
      questionNo: 53,
      charts,
      materialCards: referenceMaterials,
      writingTasks: tasks,
      rubricCriteria: baseRubric.criteria,
      submitBlockedReason:
        common.submitBlockedReason ??
        (charts.length === 0 && tasks.length === 0
          ? "problem_data_incomplete"
          : null),
    };
  }

  const scenario = scenarioRecord(materials);
  const topicTitle =
    getNestedString(scenario, "topic_seed_title") ??
    getNestedString(materials, "topic_seed_title") ??
    input.title;
  const promptParts = q54PromptParts(prompt, topicTitle);
  const summary = rubricSummaryFrom(getRubricCandidate(input.rubric, materials));
  const requiredQuestions =
    promptParts.requiredQuestions.length > 0
      ? promptParts.requiredQuestions
      : [
          getNestedString(scenario, "chart_a_focus"),
          getNestedString(scenario, "chart_b_focus"),
          getNestedString(scenario, "cross_chart_bridge"),
        ].filter((item): item is string => Boolean(item)).slice(0, 3);
  if (requiredQuestions.length < 3) {
    fallbackWarnings.push("missing_required_questions");
  }
  if (baseRubric.criteria.length === 0) {
    fallbackWarnings.push("missing_rubric");
  }

  return {
    ...common,
    kind: "q54",
    questionNo: 54,
    topicTitle,
    topicDefinition: promptParts.topicDefinition,
    background: promptParts.background,
    requiredQuestions,
    rubricSummary: summary,
    checklistItems: requiredQuestions,
    submitBlockedReason:
      common.submitBlockedReason ??
      (requiredQuestions.length < 3 || baseRubric.criteria.length === 0
        ? "problem_data_incomplete"
        : null),
  };
}
