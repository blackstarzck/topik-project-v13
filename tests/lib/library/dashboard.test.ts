import { describe, expect, it } from "vitest";

import {
  buildLibraryDashboardFromRows,
  type LibraryDashboardRows,
} from "../../../src/lib/library/dashboard";

const savedAt = "2026-06-29T13:00:00.000Z";

function libraryItem(id: string, submissionId: string, saved_at = savedAt) {
  return {
    id: `item-${id}`,
    item_type: "submission",
    problem_id: null,
    saved_at,
    submission_id: submissionId,
  } satisfies LibraryDashboardRows["libraryItems"][number];
}

function submission({
  id,
  problemId,
  questionNo,
  charCount,
  status = "complete",
  submittedAt,
  parentSubmissionId = null,
}: {
  id: string;
  problemId: string;
  questionNo: number;
  charCount: number;
  status?: "pending" | "analyzing" | "complete" | "failed";
  submittedAt: string;
  parentSubmissionId?: string | null;
}) {
  return {
    id,
    problem_id: problemId,
    question_no: questionNo,
    char_count: charCount,
    submitted_at: submittedAt,
    feedback_status: status,
    parent_submission_id: parentSubmissionId,
  } satisfies LibraryDashboardRows["submissions"][number];
}

function feedback(
  submissionId: string,
  status: "partial" | "complete" | "failed" = "complete",
) {
  return {
    submission_id: submissionId,
    status,
    score_total: 76,
    score_max: 100,
    generated_at: "2026-06-29T13:30:00.000Z",
  } satisfies LibraryDashboardRows["feedback"][number];
}

function dimension(
  submissionId: string,
  dimensionName: LibraryDashboardRows["dimensionScores"][number]["dimension"],
  score: number,
  scoreMax: number,
) {
  return {
    id: `${submissionId}-${dimensionName}`,
    submission_id: submissionId,
    dimension: dimensionName,
    score,
    score_max: scoreMax,
    summary: null,
    weakness_level: null,
  } satisfies LibraryDashboardRows["dimensionScores"][number];
}

function problem(
  id: string,
  questionNo: number,
  title: string,
  difficulty: number | null = 5,
) {
  return {
    id,
    question_no: questionNo,
    title,
    difficulty,
  } satisfies LibraryDashboardRows["problems"][number];
}

function allSubmission(id: string, problemId: string, questionNo: number) {
  return {
    id,
    problem_id: problemId,
    question_no: questionNo,
    parent_submission_id: null,
  };
}

describe("buildLibraryDashboardFromRows", () => {
  it("builds KPI counts and prioritizes review candidates from saved completed submissions", () => {
    const generated = Array.from({ length: 10 }, (_, index) => {
      const n = index + 4;
      return {
        id: `s-${n}`,
        problemId: `p-${n}`,
        questionNo: 53,
        charCount: 240 + index,
        submittedAt: `2026-06-${String(20 - index).padStart(2, "0")}T09:00:00.000Z`,
      };
    });
    const rows: LibraryDashboardRows = {
      libraryItems: [
        libraryItem("length", "s-length"),
        libraryItem("rewrite", "s-rewrite"),
        libraryItem("weak", "s-weak"),
        libraryItem("short", "s-short"),
        ...generated.map((row) => libraryItem(row.id, row.id)),
        libraryItem("pending", "s-pending"),
        libraryItem("failed", "s-failed"),
      ],
      submissions: [
        submission({
          id: "s-length",
          problemId: "p-length",
          questionNo: 54,
          charCount: 724,
          submittedAt: "2026-06-29T12:00:00.000Z",
        }),
        submission({
          id: "s-rewrite",
          problemId: "p-rewrite",
          questionNo: 53,
          charCount: 252,
          submittedAt: "2026-06-28T12:00:00.000Z",
        }),
        submission({
          id: "s-weak",
          problemId: "p-weak",
          questionNo: 53,
          charCount: 231,
          submittedAt: "2026-06-27T12:00:00.000Z",
        }),
        submission({
          id: "s-short",
          problemId: "p-short",
          questionNo: 52,
          charCount: 24,
          submittedAt: "2026-06-26T12:00:00.000Z",
        }),
        ...generated.map((row) =>
          submission({
            id: row.id,
            problemId: row.problemId,
            questionNo: row.questionNo,
            charCount: row.charCount,
            submittedAt: row.submittedAt,
          }),
        ),
        submission({
          id: "s-pending",
          problemId: "p-pending",
          questionNo: 51,
          charCount: 14,
          status: "pending",
          submittedAt: "2026-06-29T13:00:00.000Z",
        }),
        submission({
          id: "s-failed",
          problemId: "p-failed",
          questionNo: 52,
          charCount: 18,
          status: "failed",
          submittedAt: "2026-06-29T13:10:00.000Z",
        }),
      ],
      feedback: [
        feedback("s-length"),
        feedback("s-rewrite"),
        feedback("s-weak"),
        feedback("s-short"),
        ...generated.map((row) => feedback(row.id)),
        feedback("s-failed", "failed"),
      ],
      dimensionScores: [
        dimension("s-length", "structure", 68, 100),
        dimension("s-rewrite", "language", 7, 10),
        dimension("s-weak", "topic_fit", 28, 50),
        dimension("s-short", "grammar", 90, 100),
      ],
      problems: [
        problem("p-length", 54, "문화 사회형 질문"),
        problem("p-rewrite", 53, "지역 경제 활성화 방안"),
        problem("p-weak", 53, "환경 보호 정책 제안"),
        problem("p-short", 52, "의견 제시형 빈칸 완성"),
        problem("p-pending", 51, "도표 빈칸 문장 완성"),
        problem("p-failed", 52, "기술 발전의 장단점"),
        ...generated.map((row) =>
          problem(row.problemId, row.questionNo, `후보 ${row.id}`),
        ),
      ],
      allSubmissions: [
        allSubmission("s-length", "p-length", 54),
        allSubmission("s-rewrite", "p-rewrite", 53),
        allSubmission("s-rewrite-old", "p-rewrite", 53),
      ],
      studyEvents: [
        {
          id: "event-submit",
          event_type: "submission_submitted",
          occurred_at: "2026-06-29T12:35:00.000Z",
          problem_id: "p-length",
          submission_id: "s-length",
          payload: null,
        },
        {
          id: "event-ignore",
          event_type: "review_set_created",
          occurred_at: "2026-06-29T12:40:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: null,
        },
      ],
    };

    const view = buildLibraryDashboardFromRows(rows);

    expect(view.kpis).toMatchObject({
      reviewableCount: 14,
      feedbackWaitingCount: 2,
      comparisonAvailableCount: 1,
      recentSubmissionDate: "2026-06-29T13:10:00.000Z",
    });
    expect(view.reviewCandidates).toHaveLength(12);
    expect(view.reviewCandidates[0]).toMatchObject({
      submissionId: "s-length",
      primaryReason: "length_off_target",
      lengthTarget: { min: 600, max: 700, status: "over" },
      estimatedMinutes: 50,
      difficultyLevel: 5,
      scoreTotal: 76,
      scoreMax: 100,
      scorePercent: 76,
    });
    expect(view.reviewCandidates[1]).toMatchObject({
      submissionId: "s-rewrite",
      primaryReason: "comparison_available",
      hasRewrite: true,
    });
    expect(view.reviewCandidates[2]).toMatchObject({
      submissionId: "s-weak",
      primaryReason: "low_dimension",
    });
    expect(
      view.reviewCandidates.find(
        (candidate) => candidate.submissionId === "s-short",
      )?.reasons,
    ).toContain("short_answer");
    expect(
      view.reviewCandidates.find(
        (candidate) => candidate.submissionId === "s-short",
      )?.reasons,
    ).not.toContain("length_off_target");
    expect(
      view.reviewCandidates.map((candidate) => candidate.submissionId),
    ).not.toContain("s-pending");
    expect(
      view.reviewCandidates.map((candidate) => candidate.submissionId),
    ).not.toContain("s-failed");
    expect(view.timeline).toHaveLength(1);
    expect(view.timeline[0]).toMatchObject({
      eventType: "submission_submitted",
      title: "문화 사회형 질문",
    });
  });

  it("separates pending and failed saved answers and normalizes weak dimension scores", () => {
    const rows: LibraryDashboardRows = {
      libraryItems: [
        libraryItem("complete", "s-complete"),
        libraryItem("pending", "s-pending"),
        libraryItem("failed", "s-failed"),
      ],
      submissions: [
        submission({
          id: "s-complete",
          problemId: "p-complete",
          questionNo: 53,
          charCount: 250,
          submittedAt: "2026-06-29T10:00:00.000Z",
        }),
        submission({
          id: "s-pending",
          problemId: "p-pending",
          questionNo: 51,
          charCount: 14,
          status: "analyzing",
          submittedAt: "2026-06-29T11:00:00.000Z",
        }),
        submission({
          id: "s-failed",
          problemId: "p-failed",
          questionNo: 52,
          charCount: 18,
          status: "failed",
          submittedAt: "2026-06-29T12:00:00.000Z",
        }),
      ],
      feedback: [feedback("s-complete"), feedback("s-failed", "failed")],
      dimensionScores: [
        dimension("s-complete", "structure", 6, 10),
        dimension("s-complete", "language", 56, 100),
        dimension("s-complete", "topic_fit", 34, 50),
        dimension("s-complete", "grammar", 80, 100),
      ],
      problems: [
        problem("p-complete", 53, "완료 답안"),
        problem("p-pending", 51, "분석 중 답안"),
        problem("p-failed", 52, "분석 실패 답안"),
      ],
      allSubmissions: [],
      studyEvents: [],
    };

    const view = buildLibraryDashboardFromRows(rows);

    expect(view.feedbackWaiting).toEqual([
      expect.objectContaining({
        submissionId: "s-failed",
        status: "failed",
        title: "분석 실패 답안",
      }),
      expect.objectContaining({
        submissionId: "s-pending",
        status: "analyzing",
        title: "분석 중 답안",
      }),
    ]);
    expect(view.weakItems).toEqual([
      expect.objectContaining({ dimension: "language", normalizedScore: 56 }),
      expect.objectContaining({ dimension: "structure", normalizedScore: 60 }),
      expect.objectContaining({ dimension: "topic_fit", normalizedScore: 68 }),
    ]);
  });

  it("removes retry links for saved submissions whose problem is no longer visible to the caller", () => {
    const rows = {
      libraryItems: [
        libraryItem("visible", "s-visible"),
        libraryItem("hidden", "s-hidden"),
        libraryItem("failed-hidden", "s-failed-hidden"),
      ],
      submissions: [
        submission({
          id: "s-visible",
          problemId: "p-visible",
          questionNo: 53,
          charCount: 250,
          submittedAt: "2026-06-29T10:00:00.000Z",
        }),
        submission({
          id: "s-hidden",
          problemId: "p-hidden",
          questionNo: 53,
          charCount: 250,
          submittedAt: "2026-06-29T11:00:00.000Z",
        }),
        submission({
          id: "s-failed-hidden",
          problemId: "p-failed-hidden",
          questionNo: 52,
          charCount: 18,
          status: "failed",
          submittedAt: "2026-06-29T12:00:00.000Z",
        }),
      ],
      feedback: [
        feedback("s-visible"),
        feedback("s-hidden"),
        feedback("s-failed-hidden", "failed"),
      ],
      dimensionScores: [],
      problems: [
        problem("p-visible", 53, "Visible problem"),
        problem("p-hidden", 53, "Hidden problem"),
        problem("p-failed-hidden", 52, "Failed hidden problem"),
      ],
      allSubmissions: [],
      studyEvents: [],
      visibleProblemIds: ["p-visible"],
    } satisfies LibraryDashboardRows & { visibleProblemIds: string[] };

    const view = buildLibraryDashboardFromRows(rows);

    expect(
      view.reviewCandidates.find(
        (candidate) => candidate.problemId === "p-visible",
      )?.retryHref,
    ).toBe(
      "/writing/long-form-writing-53?problem=p-visible&fresh=1&retrySubmission=s-visible",
    );
    expect(
      view.reviewCandidates.find(
        (candidate) => candidate.problemId === "p-hidden",
      )?.retryHref,
    ).toBeNull();
    expect(
      view.feedbackWaiting.find((item) => item.problemId === "p-failed-hidden")
        ?.retryHref,
    ).toBeNull();
  });

  it("restores question numbers for payload-backed report and export timeline events", () => {
    const rows = {
      libraryItems: [],
      submissions: [],
      feedback: [],
      dimensionScores: [],
      problems: [
        problem("p-report", 54, "비교 리포트 문제"),
        problem("p-export", 53, "PDF 내보내기 문제"),
      ],
      allSubmissions: [
        allSubmission("s-report", "p-report", 54),
        allSubmission("s-export", "p-export", 53),
      ],
      comparisonReports: [
        {
          id: "report-1",
          current_submission_id: "s-report",
        },
      ],
      exportFiles: [
        {
          id: "export-1",
          source_type: "report",
          source_id: "report-1",
        },
      ],
      studyEvents: [
        {
          id: "event-report",
          event_type: "report_viewed",
          occurred_at: "2026-06-29T13:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: { report_id: "report-1" },
        },
        {
          id: "event-export-submission",
          event_type: "export_downloaded",
          occurred_at: "2026-06-29T12:59:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: {
            source_type: "submission",
            source_id: "s-export",
          },
        },
        {
          id: "event-export-report",
          event_type: "export_downloaded",
          occurred_at: "2026-06-29T12:58:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: { export_id: "export-1" },
        },
      ],
    } satisfies LibraryDashboardRows;

    const view = buildLibraryDashboardFromRows(rows);

    expect(view.timeline).toEqual([
      expect.objectContaining({
        id: "event-report",
        submissionId: "s-report",
        problemId: "p-report",
        questionNo: 54,
        title: "비교 리포트 문제",
      }),
      expect.objectContaining({
        id: "event-export-submission",
        submissionId: "s-export",
        problemId: "p-export",
        questionNo: 53,
        title: "PDF 내보내기 문제",
      }),
      expect.objectContaining({
        id: "event-export-report",
        submissionId: "s-report",
        problemId: "p-report",
        questionNo: 54,
        title: "비교 리포트 문제",
      }),
    ]);
  });
});
