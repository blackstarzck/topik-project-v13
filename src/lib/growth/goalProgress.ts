const TOPIK_II_SECTION_COUNT = 3;

// Official TOPIK II total-score cutoffs are out of 300 points.
// TALKPIK currently scores only the writing section, so the grade target is
// projected onto a 100-point writing scale by dividing by the 3 TOPIK II areas.
const TOPIK_II_TOTAL_CUTOFF_BY_GRADE = {
  3: 120,
  4: 150,
  5: 190,
  6: 230,
} as const;

export type GoalProgressGoal = {
  topikLevel: string | null;
  targetGrade: number | null;
};

export type GoalProgressFeedback = {
  scoreTotal: number | null;
  scoreMax: number | null;
};

export function getTopikWritingTargetScore(
  topikLevel: string | null,
  targetGrade: number | null,
): number | null {
  if (topikLevel !== "TOPIK_II" || targetGrade == null) return null;
  const totalCutoff =
    TOPIK_II_TOTAL_CUTOFF_BY_GRADE[
      targetGrade as keyof typeof TOPIK_II_TOTAL_CUTOFF_BY_GRADE
    ];
  return totalCutoff != null ? totalCutoff / TOPIK_II_SECTION_COUNT : null;
}

export function normalizeFeedbackScoreTo100(
  feedback: GoalProgressFeedback,
): number | null {
  if (feedback.scoreTotal == null) return null;
  const scoreMax = feedback.scoreMax ?? 100;
  if (scoreMax <= 0) return null;

  const normalized = (feedback.scoreTotal / scoreMax) * 100;
  if (!Number.isFinite(normalized)) return null;
  return Math.min(100, Math.max(0, normalized));
}

export function calculateGoalProgress({
  goal,
  feedbacks,
}: {
  goal: GoalProgressGoal | null;
  feedbacks: readonly GoalProgressFeedback[];
}): number | null {
  if (!goal) return null;

  const targetScore = getTopikWritingTargetScore(
    goal.topikLevel,
    goal.targetGrade,
  );
  if (targetScore == null || targetScore <= 0) return null;

  const scores = feedbacks
    .map(normalizeFeedbackScoreTo100)
    .filter((score): score is number => score != null);
  if (scores.length === 0) return null;

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(100, Math.round((averageScore / targetScore) * 100));
}
