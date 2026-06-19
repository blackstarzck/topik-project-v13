import type { WritingFeedbackRow } from "./types";

export type ExternalGrammarPoint = {
  grammar: string;
  explanation: string;
  example: string;
};

export type ExternalExercise = {
  exerciseType: string;
  question: string;
  answer: string;
  explanation: string;
  targetErrorType: string;
};

export type ExternalLearningFeedback = {
  focusAreas: string[];
  studyTips: string | null;
  grammarPoints: ExternalGrammarPoint[];
  vocabulary: string[];
  exercises: ExternalExercise[];
};

export type ExternalFeedbackSupplement = {
  learning: ExternalLearningFeedback;
  hasLearning: boolean;
};

const EMPTY_LEARNING: ExternalLearningFeedback = {
  focusAreas: [],
  studyTips: null,
  grammarPoints: [],
  vocabulary: [],
  exercises: [],
};

export function extractExternalFeedbackSupplement(
  feedback: Pick<WritingFeedbackRow, "raw_ai_result">,
): ExternalFeedbackSupplement {
  const raw = feedback.raw_ai_result;
  if (!isRecord(raw)) {
    return {
      learning: EMPTY_LEARNING,
      hasLearning: false,
    };
  }

  const learning = readLearning(raw.combined_feedback);

  return {
    learning,
    hasLearning:
      learning.focusAreas.length > 0 ||
      learning.studyTips !== null ||
      learning.grammarPoints.length > 0 ||
      learning.vocabulary.length > 0 ||
      learning.exercises.length > 0,
  };
}

function readLearning(value: unknown): ExternalLearningFeedback {
  if (!isRecord(value)) return EMPTY_LEARNING;

  return {
    focusAreas: getStringArray(value.focus_areas),
    studyTips: getString(value.study_tips),
    grammarPoints: readGrammarPoints(value.grammar_points),
    vocabulary: getStringArray(value.vocabulary),
    exercises: readExercises(value.exercises),
  };
}

function readGrammarPoints(value: unknown): ExternalGrammarPoint[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const grammar = getString(item.grammar);
    const explanation = getString(item.explanation);
    const example = getString(item.example);
    if (!grammar && !explanation && !example) return [];
    return [
      {
        grammar: grammar ?? "",
        explanation: explanation ?? "",
        example: example ?? "",
      },
    ];
  });
}

function readExercises(value: unknown): ExternalExercise[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const exerciseType = getString(item.exercise_type);
    const question = getString(item.question);
    const answer = getString(item.answer);
    const explanation = getString(item.explanation);
    const targetErrorType = getString(item.target_error_type);
    if (!exerciseType && !question && !answer && !explanation) return [];
    return [
      {
        exerciseType: exerciseType ?? "",
        question: question ?? "",
        answer: answer ?? "",
        explanation: explanation ?? "",
        targetErrorType: targetErrorType ?? "",
      },
    ];
  });
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = getString(item);
    return text ? [text] : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
