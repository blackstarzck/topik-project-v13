import { describe, expect, it } from "vitest";
import { buildLibraryDashboardFromRows } from "../../../src/lib/library/dashboard-builder";
import {
  parseLibraryDashboardTimelineEvent,
  type ComparisonReportDashboardRow,
  type ExportFileDashboardRow,
  type StudyEventDashboardRow,
} from "../../../src/lib/library/dashboard-timeline";

function event(
  overrides: Partial<StudyEventDashboardRow> = {},
): StudyEventDashboardRow {
  return {
    id: "event-1",
    event_type: "feedback_viewed",
    occurred_at: "2026-06-29T13:00:00.000Z",
    problem_id: null,
    submission_id: null,
    payload: null,
    ...overrides,
  };
}

const comparisonReportsById = new Map<string, ComparisonReportDashboardRow>([
  ["report-1", { id: "report-1", current_submission_id: "submission-report" }],
]);

const exportFilesById = new Map<string, ExportFileDashboardRow>([
  [
    "export-submission",
    {
      id: "export-submission",
      source_type: "submission",
      source_id: "submission-export",
    },
  ],
  [
    "export-report",
    {
      id: "export-report",
      source_type: "report",
      source_id: "report-1",
    },
  ],
]);

const lookups = { comparisonReportsById, exportFilesById };

describe("parseLibraryDashboardTimelineEvent", () => {
  it.each([null, [], 42, "payload"])(
    "ignores payload-derived fields when the whole payload is %j",
    (payload) => {
      expect(
        parseLibraryDashboardTimelineEvent(event({ payload })),
      ).toMatchObject({
        submissionId: null,
        payloadProblemId: null,
        payloadQuestionNo: null,
        exportId: null,
        reportId: null,
      });
    },
  );

  it.each([
    [54, 54],
    [52.5, 52.5],
    [-51, -51],
    ["53", 53],
    ["", null],
    ["52.5", null],
    ["-51", null],
  ])("parses question_no %j as %j", (questionNo, expected) => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({ payload: { question_no: questionNo } }),
      )?.payloadQuestionNo,
    ).toBe(expected);
  });

  it("prefers the event submission over a payload submission", () => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({
          submission_id: "submission-event",
          payload: { submission_id: "submission-payload" },
        }),
      )?.submissionId,
    ).toBe("submission-event");
  });

  it("uses a direct payload submission", () => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({ payload: { submission_id: "submission-payload" } }),
      )?.submissionId,
    ).toBe("submission-payload");
  });

  it("restores a report_viewed submission through its report", () => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({
          event_type: "report_viewed",
          payload: { report_id: "report-1" },
        }),
        lookups,
      ),
    ).toMatchObject({
      submissionId: "submission-report",
      reportId: "report-1",
    });
  });

  it.each([
    ["submission", "submission-source", "submission-source", null],
    ["report", "report-1", "submission-report", "report-1"],
  ] as const)(
    "restores an export with a direct %s source",
    (sourceType, sourceId, submissionId, reportId) => {
      expect(
        parseLibraryDashboardTimelineEvent(
          event({
            event_type: "export_downloaded",
            payload: { source_type: sourceType, source_id: sourceId },
          }),
          lookups,
        ),
      ).toMatchObject({ submissionId, reportId });
    },
  );

  it.each([
    ["export-submission", "submission-export", null],
    ["export-report", "submission-report", "report-1"],
  ] as const)(
    "restores an export_id lookup for %s",
    (exportId, submissionId, reportId) => {
      expect(
        parseLibraryDashboardTimelineEvent(
          event({
            event_type: "export_downloaded",
            payload: { export_id: exportId },
          }),
          lookups,
        ),
      ).toMatchObject({ exportId, submissionId, reportId });
    },
  );

  it("lets a valid library_selection source block export lookup fallback", () => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({
          event_type: "export_downloaded",
          payload: {
            source_type: "library_selection",
            source_id: "selection-1",
            export_id: "export-submission",
          },
        }),
        lookups,
      )?.submissionId,
    ).toBeNull();
  });

  it("ignores an unknown source and falls back to the export_id lookup", () => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({
          event_type: "export_downloaded",
          payload: {
            source_type: "unknown",
            source_id: "unknown-1",
            export_id: "export-submission",
          },
        }),
        lookups,
      )?.submissionId,
    ).toBe("submission-export");
  });

  it("returns null for an unknown event", () => {
    expect(
      parseLibraryDashboardTimelineEvent(
        event({ event_type: "review_set_created" }),
      ),
    ).toBeNull();
  });
});

describe("buildLibraryDashboardFromRows timeline", () => {
  it("keeps the latest four known events and preserves title and metadata precedence", () => {
    const result = buildLibraryDashboardFromRows({
      libraryItems: [],
      submissions: [],
      feedback: [],
      dimensionScores: [],
      problems: [
        {
          id: "problem-event",
          question_no: 53,
          title: "이벤트 문제",
          difficulty: null,
        },
        {
          id: "problem-submission",
          question_no: 54,
          title: "제출 문제",
          difficulty: null,
        },
      ],
      allSubmissions: [],
      timelineSubmissions: [
        {
          id: "submission-1",
          problem_id: "problem-submission",
          question_no: 54,
          history_title: "제출 당시 제목",
        },
      ],
      studyEvents: [
        event({
          id: "old-event",
          event_type: "feedback_viewed",
          occurred_at: "2026-06-29T10:00:00.000Z",
        }),
        event({
          id: "empty-fallback",
          occurred_at: "2026-06-29T11:00:00.000Z",
        }),
        event({
          id: "question-fallback",
          occurred_at: "2026-06-29T12:00:00.000Z",
          payload: { question_no: "52" },
        }),
        event({
          id: "problem-title",
          occurred_at: "2026-06-29T13:00:00.000Z",
          problem_id: "problem-event",
        }),
        event({
          id: "precedence",
          occurred_at: "2026-06-29T14:00:00.000Z",
          problem_id: "problem-event",
          submission_id: "submission-1",
          payload: { problem_id: "problem-payload", question_no: 51 },
        }),
        event({
          id: "unknown-newest",
          event_type: "review_set_created",
          occurred_at: "2026-06-29T15:00:00.000Z",
        }),
      ],
    });

    expect(result.timeline).toEqual([
      expect.objectContaining({
        id: "precedence",
        problemId: "problem-event",
        submissionId: "submission-1",
        questionNo: 54,
        title: "제출 당시 제목",
      }),
      expect.objectContaining({ id: "problem-title", title: "이벤트 문제" }),
      expect.objectContaining({
        id: "question-fallback",
        title: "52번 문제",
      }),
      expect.objectContaining({ id: "empty-fallback", title: "저장 답안" }),
    ]);
  });
});
