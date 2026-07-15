import { describe, expect, it } from "vitest";

import {
  buildLibraryDashboardFromRows,
  getLibraryDashboard,
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

function makeDashboardClientForTimelineSubmissionFetch(
  canonicalRows: Array<Record<string, unknown>> = [],
  canonicalError: string | null = null,
  historyRows: Array<Record<string, unknown>> = [],
  nonWritingRows: Array<Record<string, unknown>> = [],
) {
  const oldSubmissions = [
    {
      id: "s-old-report",
      problem_id: "p-old-report",
      question_no: 54,
      parent_submission_id: null,
    },
    {
      id: "s-old-export",
      problem_id: "p-old-export",
      question_no: 53,
      parent_submission_id: null,
    },
  ];
  const queries: Array<{
    table: string;
    inFilters: Array<{ column: string; values: unknown[] }>;
  }> = [];

  return {
    queries,
    client: {
      from(table: string) {
        const query = {
          table,
          inFilters: [] as Array<{ column: string; values: unknown[] }>,
        };
        queries.push(query);

        const resolve = () => {
          if (table === "library_items") {
            return { data: [], error: null };
          }
          if (table === "writing_submissions") {
            const ids = query.inFilters.find(
              (filter) => filter.column === "id",
            )?.values;
            return {
              data: ids
                ? oldSubmissions.filter((row) => ids.includes(row.id))
                : [],
              error: null,
            };
          }
          if (table === "writing_feedback") {
            return { data: [], error: null };
          }
          if (table === "feedback_dimension_scores") {
            return { data: [], error: null };
          }
          if (table === "study_events") {
            return {
              data: [
                {
                  id: "event-old-report",
                  event_type: "report_viewed",
                  occurred_at: "2026-06-29T13:00:00.000Z",
                  problem_id: null,
                  submission_id: null,
                  payload: { report_id: "report-old" },
                },
                {
                  id: "event-old-export",
                  event_type: "export_downloaded",
                  occurred_at: "2026-06-29T12:59:00.000Z",
                  problem_id: null,
                  submission_id: null,
                  payload: {
                    source_type: "submission",
                    source_id: "s-old-export",
                  },
                },
              ],
              error: null,
            };
          }
          if (table === "comparison_reports") {
            return {
              data: [
                {
                  id: "report-old",
                  current_submission_id: "s-old-report",
                },
              ],
              error: null,
            };
          }
          if (table === "export_files") {
            return { data: [], error: null };
          }
          if (table === "problems") {
            const ids = query.inFilters.find(
              (filter) => filter.column === "id",
            )?.values;
            return {
              data: ids
                ? nonWritingRows.filter((row) => ids.includes(row.id))
                : nonWritingRows,
              error: null,
            };
          }
          throw new Error(`unexpected table ${table}`);
        };

        const resolvePromise = () => Promise.resolve(resolve());
        const chain = {
          select: () => chain,
          eq: () => chain,
          neq: () => chain,
          order: () => chain,
          in: (column: string, values: unknown[]) => {
            query.inFilters.push({ column, values });
            return chain;
          },
          limit: () => resolvePromise(),
          then: (
            onfulfilled?: Parameters<Promise<unknown>["then"]>[0],
            onrejected?: Parameters<Promise<unknown>["then"]>[1],
          ) => resolvePromise().then(onfulfilled, onrejected),
          catch: (onrejected?: Parameters<Promise<unknown>["catch"]>[0]) =>
            resolvePromise().catch(onrejected),
          finally: (onfinally?: Parameters<Promise<unknown>["finally"]>[0]) =>
            resolvePromise().finally(onfinally),
        };
        return chain;
      },
      rpc(
        name: string,
        args: {
          p_problem_ids?: string[];
          p_submission_ids?: string[];
          p_item_number?: number | null;
          p_problem_id?: string | null;
        },
      ) {
        if (name === "get_writing_submission_history_context") {
          return Promise.resolve({ data: historyRows, error: null });
        }
        if (name === "get_available_writing_questions") {
          return Promise.resolve({
            data: canonicalRows,
            error: canonicalError ? { message: canonicalError } : null,
          });
        }
        return Promise.resolve({
          data: (args.p_problem_ids ?? []).map((problem_id) => ({
            problem_id,
          })),
          error: null,
        });
      },
    },
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

  it("keeps full pending and analyzing sync targets separate from the two visible waiting rows", () => {
    const rows: LibraryDashboardRows = {
      libraryItems: [
        libraryItem("pending-1", "s-pending-1"),
        libraryItem("pending-2", "s-pending-2"),
        libraryItem("analyzing-3", "s-analyzing-3"),
        libraryItem("failed", "s-failed"),
      ],
      submissions: [
        submission({
          id: "s-pending-1",
          problemId: "p-pending-1",
          questionNo: 51,
          charCount: 14,
          status: "pending",
          submittedAt: "2026-06-29T13:00:00.000Z",
        }),
        submission({
          id: "s-pending-2",
          problemId: "p-pending-2",
          questionNo: 52,
          charCount: 18,
          status: "pending",
          submittedAt: "2026-06-29T12:00:00.000Z",
        }),
        submission({
          id: "s-analyzing-3",
          problemId: "p-analyzing-3",
          questionNo: 53,
          charCount: 220,
          status: "analyzing",
          submittedAt: "2026-06-29T11:00:00.000Z",
        }),
        submission({
          id: "s-failed",
          problemId: "p-failed",
          questionNo: 54,
          charCount: 620,
          status: "failed",
          submittedAt: "2026-06-29T10:00:00.000Z",
        }),
      ],
      feedback: [feedback("s-failed", "failed")],
      dimensionScores: [],
      problems: [
        problem("p-pending-1", 51, "Pending 1"),
        problem("p-pending-2", 52, "Pending 2"),
        problem("p-analyzing-3", 53, "Analyzing 3"),
        problem("p-failed", 54, "Failed"),
      ],
      allSubmissions: [],
      studyEvents: [],
    };

    const view = buildLibraryDashboardFromRows(rows);

    expect(view.kpis.feedbackWaitingCount).toBe(4);
    expect(view.feedbackWaiting).toHaveLength(2);
    expect(view.feedbackWaiting.map((item) => item.submissionId)).toEqual([
      "s-pending-1",
      "s-pending-2",
    ]);
    expect(view.feedbackWaitingSyncTargets).toEqual([
      {
        itemId: "item-pending-1",
        submissionId: "s-pending-1",
        initialStatus: "pending",
      },
      {
        itemId: "item-pending-2",
        submissionId: "s-pending-2",
        initialStatus: "pending",
      },
      {
        itemId: "item-analyzing-3",
        submissionId: "s-analyzing-3",
        initialStatus: "analyzing",
      },
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

  it("restores direct submission, problem, and question numbers from event payloads", () => {
    const rows = {
      libraryItems: [],
      submissions: [],
      feedback: [],
      dimensionScores: [],
      problems: [problem("p-payload-feedback", 52, "Payload feedback problem")],
      allSubmissions: [],
      studyEvents: [
        {
          id: "event-payload-feedback",
          event_type: "feedback_viewed",
          occurred_at: "2026-06-29T13:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: {
            submission_id: "s-payload-feedback",
            problem_id: "p-payload-feedback",
            question_no: 52,
          },
        },
      ],
    } satisfies LibraryDashboardRows;

    const view = buildLibraryDashboardFromRows(rows);

    expect(view.timeline).toEqual([
      expect.objectContaining({
        id: "event-payload-feedback",
        submissionId: "s-payload-feedback",
        problemId: "p-payload-feedback",
        questionNo: 52,
        title: "Payload feedback problem",
      }),
    ]);
  });

  it("prefers the fetched submission problem over a mismatched payload problem", () => {
    const rows = {
      libraryItems: [],
      submissions: [],
      feedback: [],
      dimensionScores: [],
      problems: [
        problem("p-submission-feedback", 54, "Submission feedback problem"),
        problem("p-payload-feedback", 51, "Stale payload problem"),
      ],
      allSubmissions: [
        allSubmission("s-mismatch-feedback", "p-submission-feedback", 54),
      ],
      studyEvents: [
        {
          id: "event-mismatch-feedback",
          event_type: "feedback_viewed",
          occurred_at: "2026-06-29T13:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: {
            submission_id: "s-mismatch-feedback",
            problem_id: "p-payload-feedback",
            question_no: 51,
          },
        },
      ],
    } satisfies LibraryDashboardRows;

    const view = buildLibraryDashboardFromRows(rows);

    expect(view.timeline).toEqual([
      expect.objectContaining({
        id: "event-mismatch-feedback",
        submissionId: "s-mismatch-feedback",
        problemId: "p-submission-feedback",
        questionNo: 54,
        title: "Submission feedback problem",
      }),
    ]);
  });
});

describe("getLibraryDashboard", () => {
  it("hydrates writing timeline metadata from canonical instead of public mirrors", async () => {
    const { client, queries } = makeDashboardClientForTimelineSubmissionFetch([
      canonicalDashboardRow("p-old-report", 54, "Canonical report problem"),
      canonicalDashboardRow("p-old-export", 53, "Canonical export problem"),
    ]);

    const view = await getLibraryDashboard(
      "user-1",
      async () => client as never,
    );

    expect(view.timeline.map((item) => item.title)).toEqual([
      "Canonical report problem",
      "Canonical export problem",
    ]);
    expect(queries.some((query) => query.table === "problems")).toBe(true);
  });

  it("hydrates non-writing metadata from public.problems when canonical has no match", async () => {
    const { client, queries } = makeDashboardClientForTimelineSubmissionFetch(
      [canonicalDashboardRow("p-old-report", 54, "Canonical report problem")],
      null,
      [],
      [problem("p-old-export", 53, "Old export problem")],
    );

    const view = await getLibraryDashboard(
      "user-1",
      async () => client as never,
    );

    expect(view.timeline.map((item) => item.title)).toEqual([
      "Canonical report problem",
      "Old export problem",
    ]);
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "problems",
          inFilters: [
            {
              column: "id",
              values: ["p-old-report", "p-old-export"],
            },
          ],
        }),
      ]),
    );
  });

  it("keeps historical non-writing metadata without depending on canonical availability", async () => {
    const { client } = makeDashboardClientForTimelineSubmissionFetch(
      [],
      "catalog unavailable",
      [],
      [
        {
          ...problem("p-old-report", 54, "Archived report problem"),
          publish_status: "archived",
          visibility: "org",
          lifecycle_status: "inactive",
        },
        {
          ...problem("p-old-export", 53, "Inactive export problem"),
          publish_status: "published",
          visibility: "public",
          lifecycle_status: "inactive",
        },
      ],
    );

    const view = await getLibraryDashboard(
      "user-1",
      async () => client as never,
    );

    expect(view.timeline.map((item) => item.title)).toEqual([
      "Archived report problem",
      "Inactive export problem",
    ]);
  });

  it("uses retained submission snapshots for historical cards even when current canonical content changed", async () => {
    const pinnedTitle = "Pinned historical title";
    const { client } = makeDashboardClientForTimelineSubmissionFetch(
      [
        canonicalDashboardRow("p-old-report", 54, "Current canonical title"),
        canonicalDashboardRow("p-old-export", 53, "Current canonical title"),
      ],
      null,
      [
        { submission_id: "s-old-report", title: pinnedTitle },
        { submission_id: "s-old-export", title: pinnedTitle },
      ],
    );

    const view = await getLibraryDashboard(
      "user-1",
      async () => client as never,
    );

    expect(view.timeline).toHaveLength(2);
    expect(view.timeline.every((item) => item.title === pinnedTitle)).toBe(
      true,
    );
  });

  it("fetches payload-linked historical submissions outside the recent cache", async () => {
    const { client, queries } = makeDashboardClientForTimelineSubmissionFetch([
      canonicalDashboardRow("p-old-report", 54, "Old report problem"),
      canonicalDashboardRow("p-old-export", 53, "Old export problem"),
    ]);

    const view = await getLibraryDashboard(
      "user-1",
      async () => client as never,
    );

    expect(view.timeline).toEqual([
      expect.objectContaining({
        id: "event-old-report",
        submissionId: "s-old-report",
        problemId: "p-old-report",
        questionNo: 54,
        title: "Old report problem",
      }),
      expect.objectContaining({
        id: "event-old-export",
        submissionId: "s-old-export",
        problemId: "p-old-export",
        questionNo: 53,
        title: "Old export problem",
      }),
    ]);
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "writing_submissions",
          inFilters: [
            { column: "id", values: ["s-old-report", "s-old-export"] },
          ],
        }),
      ]),
    );
  });

  it("surfaces canonical catalog failures instead of falling back to mirrored problem content", async () => {
    const { client, queries } = makeDashboardClientForTimelineSubmissionFetch(
      [],
      "catalog unavailable",
    );

    await expect(
      getLibraryDashboard("user-1", async () => client as never),
    ).rejects.toThrow("getCanonicalWritingProblems: catalog unavailable");
    expect(queries.some((query) => query.table === "problems")).toBe(true);
  });
});

function canonicalDashboardRow(
  problemId: string,
  itemNumber: number,
  title: string,
) {
  return {
    problem_id: problemId,
    question_id: `topik-writing-${itemNumber}-0001`,
    canonical_import_id: 101,
    payload_hash: `hash-${problemId}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt: "문항 안내",
    tags: [],
    materials:
      itemNumber === 54
        ? {
            prompt_questions: ["질문 1", "질문 2", "질문 3"],
            required_structure: ["도입", "본론", "결론"],
          }
        : {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}
