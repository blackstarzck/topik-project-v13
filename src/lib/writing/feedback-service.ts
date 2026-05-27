import type {
  FeedbackDimensionKey,
  QuestionNo,
} from "./types";
import { FEEDBACK_DIMENSIONS, isLongForm } from "./types";

export type FeedbackPayload = {
  feedback: {
    status: "complete";
    score_total: number;
    score_max: number;
    overall_summary: string;
    ai_model: string;
    ai_model_version: string;
  };
  dimensions: Array<{
    dimension: FeedbackDimensionKey;
    score: number;
    score_max: number;
    summary: string;
    weakness_level: number;
  }>;
  sentences: Array<{
    sentence_index: number;
    original_text: string;
    corrected_text: string;
    comment: string;
  }>;
};

type Input = {
  question_no: QuestionNo;
  char_count: number;
  answer_text: string;
};

const MODEL = "mock-v1";
const MODEL_VERSION = "phase-5";

export function generateMockFeedback(input: Input): FeedbackPayload {
  const base = 70 + (input.char_count % 30);
  const total = clamp(base, 50, 99);
  const dimensions = FEEDBACK_DIMENSIONS.map((dimension, i) => {
    const score = clamp(total - 6 + i * 2, 40, 99);
    return {
      dimension,
      score,
      score_max: 100,
      summary: dimensionSummary(dimension, score),
      weakness_level: score < 70 ? 4 : score < 85 ? 3 : 1,
    };
  });
  const sentences = isLongForm(input.question_no)
    ? splitSentences(input.answer_text).map((original, idx) => ({
        sentence_index: idx,
        original_text: original,
        corrected_text: original,
        comment: `${idx + 1}번째 문장은 표현을 더 다양하게 시도해 보세요.`,
      }))
    : [];

  return {
    feedback: {
      status: "complete",
      score_total: total,
      score_max: 100,
      overall_summary:
        total >= 80
          ? "전반적으로 안정적인 답안입니다. 표현 다듬으면 더 좋겠어요."
          : "기본 골격은 갖췄으나, 어휘/문법의 정확성을 다듬으세요.",
      ai_model: MODEL,
      ai_model_version: MODEL_VERSION,
    },
    dimensions,
    sentences,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dimensionSummary(dim: FeedbackDimensionKey, score: number): string {
  const tier = score >= 85 ? "강점" : score >= 70 ? "양호" : "보완 필요";
  const labels: Record<FeedbackDimensionKey, string> = {
    grammar: "문법",
    vocab: "어휘",
    structure: "구성",
    content: "내용",
    expression: "표현",
    topic_fit: "주제 적합도",
  };
  return `${labels[dim]} — ${tier}`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?。…]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 12);
}
