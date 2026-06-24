import type { UserProblemRow } from "./problem-list-data";

export type ProblemRowSolveStatus =
  | "unsolved"
  | "completed"
  | "wrongNote"
  | "reviewNeeded";

export type ProblemRowDisplayMeta = {
  estimatedMinutes: number | null;
  previousScore: number | null;
  solveStatus: ProblemRowSolveStatus;
  isNew?: boolean;
};

const REFERENCE_ROW_META_BY_TITLE = new Map<string, ProblemRowDisplayMeta>([
  [
    "51-128_동의어 어휘 빈칸",
    {
      estimatedMinutes: 12,
      previousScore: null,
      solveStatus: "unsolved",
      isNew: true,
    },
  ],
  [
    "51-127_반의어 어휘 빈칸",
    { estimatedMinutes: 10, previousScore: 85, solveStatus: "completed" },
  ],
  [
    "51-126_관용 표현 빈칸",
    { estimatedMinutes: 13, previousScore: 62, solveStatus: "wrongNote" },
  ],
  [
    "51-125_접속 부사 빈칸",
    { estimatedMinutes: 15, previousScore: null, solveStatus: "unsolved" },
  ],
  [
    "51-124_문맥상 어휘 빈칸",
    { estimatedMinutes: 12, previousScore: 90, solveStatus: "completed" },
  ],
  [
    "51-123_유의어 어휘 빈칸",
    { estimatedMinutes: 9, previousScore: 70, solveStatus: "reviewNeeded" },
  ],
]);

function fallbackEstimatedMinutes(difficulty: number | null): number | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return 9;
  if (difficulty === 2) return 10;
  if (difficulty === 3) return 12;
  return 15;
}

function fallbackSolveStatus(row: UserProblemRow): ProblemRowSolveStatus {
  if (row.solveState === "submitted") return "completed";
  if (row.solveState === "attempted") return "reviewNeeded";
  return "unsolved";
}

export function getProblemRowDisplayMeta(
  row: UserProblemRow,
): ProblemRowDisplayMeta {
  const referenceMeta = REFERENCE_ROW_META_BY_TITLE.get(row.title);
  if (referenceMeta) {
    // 실제 제출 점수가 있으면 데모 reference 값보다 우선한다.
    return {
      ...referenceMeta,
      previousScore: row.previousScore ?? referenceMeta.previousScore,
    };
  }

  return {
    estimatedMinutes: fallbackEstimatedMinutes(row.difficulty),
    previousScore: row.previousScore ?? null,
    solveStatus: fallbackSolveStatus(row),
    isNew: false,
  };
}
