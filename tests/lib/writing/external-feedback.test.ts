import { describe, expect, it } from "vitest";

import { extractExternalFeedbackSupplement } from "../../../src/lib/writing/external-feedback";
import type { WritingFeedbackRow } from "../../../src/lib/writing/types";

function feedback(rawAiResult: unknown): WritingFeedbackRow {
  return {
    raw_ai_result: rawAiResult,
  } as unknown as WritingFeedbackRow;
}

describe("extractExternalFeedbackSupplement", () => {
  it("extracts combined feedback into learning material fallback sections", () => {
    const result = extractExternalFeedbackSupplement(
      feedback({
        combined_feedback: {
          focus_areas: ["formal endings", "topic fit"],
          study_tips: "Start by matching the prompt context.",
          vocabulary: ["therefore", "however"],
          grammar_points: [
            {
              grammar: "-습니다",
              explanation: "Use formal endings in TOPIK writing.",
              example: "정보의 중요성은 커지고 있습니다.",
            },
          ],
          exercises: [
            {
              exercise_type: "rewrite",
              question: "Rewrite the sentence formally.",
              answer: "정보의 중요성은 커지고 있습니다.",
              explanation: "The ending is formal.",
              target_error_type: "style",
            },
          ],
        },
      }),
    );

    expect(result.learning).toMatchObject({
      focusAreas: ["formal endings", "topic fit"],
      studyTips: "Start by matching the prompt context.",
      vocabulary: ["therefore", "however"],
      grammarPoints: [
        {
          grammar: "-습니다",
          explanation: "Use formal endings in TOPIK writing.",
          example: "정보의 중요성은 커지고 있습니다.",
        },
      ],
      exercises: [
        {
          exerciseType: "rewrite",
          question: "Rewrite the sentence formally.",
          answer: "정보의 중요성은 커지고 있습니다.",
          explanation: "The ending is formal.",
          targetErrorType: "style",
        },
      ],
    });
    expect(result.hasLearning).toBe(true);
  });
});
