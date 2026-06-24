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

export type NormalizedMaterialCardRow = {
  label: string;
  value: string;
};

export type NormalizedMaterialCard =
  | {
      id: string;
      kind: "chart";
      title: string;
      subtitle: string | null;
      chart: NormalizedChart;
      rows?: undefined;
      warning?: string;
    }
  | {
      id: string;
      kind: "reference";
      title: string;
      subtitle: string | null;
      chart?: undefined;
      rows: NormalizedMaterialCardRow[];
      warning?: string;
    };

export type NormalizedEssayGuidanceSection = {
  id: string;
  title: string;
  description: string | null;
  items: string[];
  required: boolean;
};

export type NormalizedEssayGuidance = {
  structure: NormalizedEssayGuidanceSection[];
  reasonCount: number | null;
  reasoningPattern: string | null;
  scoringFocus: string[];
  prohibitedElements: string[];
  modelOutline: NormalizedEssayGuidanceSection[];
};

type NormalizedProblemCommon = {
  id: string;
  title: string;
  textType: string | null;
  prompt: string;
  questionNo: QuestionNo;
  lifecycleStatus: ProblemLifecycleStatus;
  lifecycleReason: string | null;
  rubric: NormalizedRubric;
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
      materialCards: NormalizedMaterialCard[];
      guideCards: string[];
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
      essayGuidance: NormalizedEssayGuidance;
    });

export type WritingProblemNormalizerInput = {
  id: string;
  title: string;
  textType?: string | null;
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

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
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

function getNestedRecord(
  record: AnyRecord | null,
  key: string,
): AnyRecord | null {
  return record ? asRecord(record[key]) : null;
}

function getNestedString(record: AnyRecord | null, key: string): string | null {
  return record ? asString(record[key]) : null;
}

function firstDefinedField(sources: Array<AnyRecord | null>, key: string) {
  for (const source of sources) {
    if (!source) continue;
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function extractTextType(materials: AnyRecord | null): string | null {
  return (
    getNestedString(materials, "text_type") ??
    getNestedString(getNestedRecord(materials, "meta"), "text_type") ??
    getNestedString(getNestedRecord(materials, "taxonomy"), "text_type") ??
    getNestedString(
      getNestedRecord(materials, "approved_topic_seed"),
      "text_type",
    )
  );
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

  return Array.from(prompt.matchAll(/\d\)\s*([^?。.!]+[?？])/g), (match) =>
    match[1]?.trim(),
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
      return { conditions: list.slice(0, 5), criteria: list.slice(0, 5) };
    }
  }
  const candidate = getRubricCandidate(rubric, materials);
  if (!candidate) return { conditions: [], criteria: [] };

  const conditions = asStringList(
    candidate.conditions ?? candidate["조건"] ?? candidate.tasks,
  ).slice(0, 5);

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
      Array.from(
        prompt.matchAll(/[（(]\s*([ㄱ-ㅎ])\s*[）)]/g),
        (match) => match[1],
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
      acceptedAnswers: answers.length > 0 ? answers : blank.acceptedAnswers,
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

function chartSubtitle(chart: NormalizedChart): string | null {
  const parts = [
    chart.unit,
    chart.surveyOrg,
    chart.yearRange.length > 0 ? chart.yearRange.join("-") : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function materialCardRows(
  record: AnyRecord | null,
): NormalizedMaterialCardRow[] {
  if (!record) return [];
  const candidates: Array<[unknown, unknown]> = [
    [record.row1_label, record.row1_value],
    [record.row2_label, record.row2_value],
    [record.row3_label, record.row3_value],
  ];
  const seen = new Set<string>();
  return candidates.flatMap(([rawLabel, rawValue]) => {
    const label = asString(rawLabel);
    const value = asString(rawValue);
    const key = `${label}:${value}`;
    if (!label || !value || seen.has(key)) return [];
    seen.add(key);
    return [{ label, value }];
  });
}

function contextNotesRecord(materials: AnyRecord | null): AnyRecord | null {
  const scenario = getNestedRecord(materials, "scenario");
  return (
    getNestedRecord(materials, "context_notes") ??
    getNestedRecord(scenario, "context_notes")
  );
}

function normalizeMaterialCards(
  materials: AnyRecord | null,
  charts: NormalizedChart[],
): NormalizedMaterialCard[] {
  const chartCards: NormalizedMaterialCard[] = charts.map((chart) => ({
    id: chart.id,
    kind: "chart" as const,
    title: chart.title,
    subtitle: chartSubtitle(chart),
    chart,
    warning:
      chart.series.length === 0 || chart.chartType === "unknown"
        ? "chart_unrenderable"
        : undefined,
  }));
  const contextNotes = contextNotesRecord(materials);
  const rows = materialCardRows(contextNotes);
  const referenceCards: NormalizedMaterialCard[] =
    rows.length > 0
      ? [
          {
            id: "context_notes",
            kind: "reference" as const,
            title: asString(contextNotes?.display_label) ?? "Reference",
            subtitle: null,
            rows,
          },
        ]
      : [];
  return [...chartCards, ...referenceCards].slice(0, 3);
}

function extractGuideCards(materials: AnyRecord | null): string[] {
  return [
    ...asStringList(materials?.guide_cards),
    ...asStringList(materials?.ai_guide_cards),
  ].slice(0, 3);
}

function scenarioRecord(materials: AnyRecord | null): AnyRecord | null {
  return (
    getNestedRecord(materials, "scenario") ??
    getNestedRecord(materials, "scenario_logic")
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

function normalizeGuidanceSection(
  raw: unknown,
  index: number,
  fallbackRequired: boolean,
): NormalizedEssayGuidanceSection | null {
  const id = `section-${index + 1}`;
  if (typeof raw === "string") {
    const title = raw.trim();
    return title
      ? { id, title, description: null, items: [], required: fallbackRequired }
      : null;
  }
  const obj = asRecord(raw);
  if (!obj) return null;

  const title =
    asString(obj.title) ??
    asString(obj.label) ??
    asString(obj.name) ??
    asString(obj.section) ??
    asString(obj.heading);
  const description =
    asString(obj.description) ??
    asString(obj.instruction) ??
    asString(obj.requirement) ??
    asString(obj.body) ??
    asString(obj.content);
  const items = [
    ...asStringList(obj.items),
    ...asStringList(obj.children),
    ...asStringList(obj.details),
    ...asStringList(obj.subitems),
    ...asStringList(obj.bullets),
  ];
  const textFallback = asString(obj.text);
  const required =
    typeof obj.required === "boolean"
      ? obj.required
      : typeof obj.is_required === "boolean"
        ? obj.is_required
        : fallbackRequired;

  if (!title && !description && !textFallback && items.length === 0) {
    return null;
  }

  return {
    id: asString(obj.id) ?? id,
    title: title ?? description ?? textFallback ?? id,
    description: title ? (description ?? textFallback) : null,
    items,
    required,
  };
}

function splitGuidanceStructure(raw: string): string[] {
  const byArrow = raw
    .split(/\s*(?:→|->|⇒|>|,)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return byArrow.length > 1 ? byArrow : [raw.trim()].filter(Boolean);
}

function normalizeGuidanceSections(
  value: unknown,
  fallbackRequired: boolean,
): NormalizedEssayGuidanceSection[] {
  const rawItems =
    typeof value === "string"
      ? splitGuidanceStructure(value)
      : Array.isArray(value)
        ? value
        : [];
  return rawItems
    .map((item, index) =>
      normalizeGuidanceSection(item, index, fallbackRequired),
    )
    .filter((item): item is NormalizedEssayGuidanceSection => Boolean(item))
    .slice(0, 6);
}

function fallbackEssayStructure(
  requiredQuestions: string[],
): NormalizedEssayGuidanceSection[] {
  return [
    {
      id: "intro",
      title: "서론",
      description: "주제에 대한 자신의 입장을 분명히 제시하세요.",
      items: requiredQuestions[0] ? [requiredQuestions[0]] : [],
      required: true,
    },
    {
      id: "body",
      title: "본론",
      description: "입장을 뒷받침하는 근거와 사례를 연결해 설명하세요.",
      items: requiredQuestions.slice(1),
      required: true,
    },
    {
      id: "conclusion",
      title: "결론",
      description: "앞서 쓴 내용을 요약하고 자신의 입장을 다시 강조하세요.",
      items: [],
      required: true,
    },
  ];
}

function normalizeModelOutline(
  value: unknown,
): NormalizedEssayGuidanceSection[] {
  const arraySections = normalizeGuidanceSections(value, false);
  if (arraySections.length > 0) return arraySections;

  const obj = asRecord(value);
  if (!obj) return [];
  const preferredKeys = ["intro", "body", "conclusion"];
  const labels: Record<string, string> = {
    intro: "서론",
    body: "본론",
    conclusion: "결론",
  };
  const keys = [
    ...preferredKeys.filter((key) => obj[key] !== undefined),
    ...Object.keys(obj).filter((key) => !preferredKeys.includes(key)),
  ];

  return keys.flatMap((key, index) => {
    const raw = obj[key];
    const nested = normalizeGuidanceSection(raw, index, false);
    if (nested && (asRecord(raw) || Array.isArray(raw))) {
      return [
        {
          ...nested,
          id: asString(nested.id) ?? `outline-${key}`,
          title: labels[key] ?? nested.title,
          required: false,
        },
      ];
    }
    const items = asStringList(raw);
    return items.length > 0
      ? [
          {
            id: `outline-${key}`,
            title: labels[key] ?? key,
            description: null,
            items,
            required: false,
          },
        ]
      : [];
  });
}

function q54GuidanceSources(
  materials: AnyRecord | null,
  rubricCandidate: AnyRecord | null,
): Array<AnyRecord | null> {
  return [
    materials,
    getNestedRecord(materials, "metadata"),
    getNestedRecord(materials, "meta"),
    getNestedRecord(materials, "q54"),
    getNestedRecord(materials, "writing_54"),
    getNestedRecord(materials, "topik_writing_54"),
    getNestedRecord(materials, "topik_writing_54_question"),
    scenarioRecord(materials),
    getNestedRecord(rubricCandidate, "guidance"),
  ];
}

function normalizeEssayGuidance(
  materials: AnyRecord | null,
  rubricCandidate: AnyRecord | null,
  requiredQuestions: string[],
): NormalizedEssayGuidance {
  const sources = q54GuidanceSources(materials, rubricCandidate);
  const requiredStructure = firstDefinedField(sources, "required_structure");
  const structure =
    normalizeGuidanceSections(requiredStructure, true).length > 0
      ? normalizeGuidanceSections(requiredStructure, true)
      : fallbackEssayStructure(requiredQuestions);

  return {
    structure,
    reasonCount: asInteger(firstDefinedField(sources, "required_reason_count")),
    reasoningPattern: asString(firstDefinedField(sources, "reasoning_pattern")),
    scoringFocus: asStringList(
      firstDefinedField(sources, "scoring_focus"),
    ).slice(0, 6),
    prohibitedElements: asStringList(
      firstDefinedField(sources, "prohibited_elements"),
    ).slice(0, 4),
    modelOutline: normalizeModelOutline(
      firstDefinedField(sources, "model_outline"),
    ),
  };
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
  const baseRubric = normalizeRubric(input.rubric, materials);
  const submitBlockedReason =
    lifecycleStatus === "active" ? null : ("lifecycle" as const);

  const common = {
    id: input.id,
    title: input.title,
    textType: input.textType ?? extractTextType(materials),
    prompt,
    questionNo: input.questionNo,
    lifecycleStatus,
    lifecycleReason: input.lifecycleReason ?? null,
    rubric: baseRubric,
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
    // 채점 rubric은 외부 백엔드가 question_id로 로드하므로 v13 rubric(표시용)이 비어도
    // 제출을 막지 않는다. q51과 동일하게 빈칸 존재 여부로만 완결성을 판단한다.
    // (§7 미러 q52는 rubric/criteria가 없어, 이를 요구하면 제출이 부당하게 차단됨.)
    const incomplete =
      (input.questionNo === 52 && blanks.length === 0) ||
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
    const materialCards = normalizeMaterialCards(materials, charts);
    const tasks = extractPromptNumberedItems(prompt).slice(0, 3);
    if (charts.length === 0) fallbackWarnings.push("missing_charts");
    if (tasks.length === 0) fallbackWarnings.push("missing_writing_tasks");
    return {
      ...common,
      kind: "q53",
      questionNo: 53,
      charts,
      materialCards,
      guideCards: extractGuideCards(materials),
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
  const topicTitle = input.title;
  const promptParts = q54PromptParts(prompt, topicTitle);
  const rubricCandidate = getRubricCandidate(input.rubric, materials);
  const summary = rubricSummaryFrom(rubricCandidate);
  const requiredQuestions =
    promptParts.requiredQuestions.length > 0
      ? promptParts.requiredQuestions
      : [
          getNestedString(scenario, "chart_a_focus"),
          getNestedString(scenario, "chart_b_focus"),
          getNestedString(scenario, "cross_chart_bridge"),
        ]
          .filter((item): item is string => Boolean(item))
          .slice(0, 3);
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
    essayGuidance: normalizeEssayGuidance(
      materials,
      rubricCandidate,
      requiredQuestions,
    ),
    submitBlockedReason:
      common.submitBlockedReason ??
      (requiredQuestions.length < 3 || baseRubric.criteria.length === 0
        ? "problem_data_incomplete"
        : null),
  };
}
