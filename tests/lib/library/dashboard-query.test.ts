import { describe, expect, it } from "vitest";

import { queryLibraryDashboardRows } from "../../../src/lib/library/dashboard-query";

type QueryRecord = {
  kind: "table";
  table: string;
  select: string | null;
  operations: Array<{ name: string; args: unknown[] }>;
};

type RpcRecord = {
  kind: "rpc";
  name: string;
  args: unknown;
};

type Record = QueryRecord | RpcRecord;

const SAVED_SUBMISSION_SELECT =
  "id, problem_id, question_no, char_count, submitted_at, feedback_status, parent_submission_id";
const ALL_SUBMISSION_SELECT =
  "id, problem_id, question_no, parent_submission_id";
const TIMELINE_SUBMISSION_SELECT = "id, problem_id, question_no";

function canonicalRow(problemId: string, itemNumber = 54) {
  return {
    problem_id: problemId,
    question_id: `question-${problemId}`,
    canonical_import_id: 1,
    payload_hash: `hash-${problemId}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty: 3,
    title: `Canonical ${problemId}`,
    prompt: "Prompt",
    tags: [],
    materials: {},
    source_created_at: "2026-08-01T00:00:00.000Z",
    source_updated_at: "2026-08-01T00:00:00.000Z",
  };
}

function makeRecorder({
  empty = false,
  failAt = null,
}: {
  empty?: boolean;
  failAt?: string | null;
} = {}) {
  const records: Record[] = [];
  const error = { message: "boom" };

  const libraryItems = empty
    ? []
    : [
        {
          id: "item-b",
          item_type: "submission",
          problem_id: "p-library",
          saved_at: "2026-08-03T00:00:00.000Z",
          submission_id: "s-saved-b",
        },
        {
          id: "item-a",
          item_type: "submission",
          problem_id: null,
          saved_at: "2026-08-02T00:00:00.000Z",
          submission_id: "s-saved-a",
        },
        {
          id: "item-b-copy",
          item_type: "submission",
          problem_id: "p-library",
          saved_at: "2026-08-01T00:00:00.000Z",
          submission_id: "s-saved-b",
        },
      ];
  const studyEvents = empty
    ? []
    : [
        {
          id: "event-direct",
          event_type: "submission_submitted",
          occurred_at: "2026-08-03T00:00:00.000Z",
          problem_id: "p-event",
          submission_id: "s-direct",
          payload: null,
        },
        {
          id: "event-payload",
          event_type: "feedback_viewed",
          occurred_at: "2026-08-02T23:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: {
            submission_id: "s-payload",
            problem_id: "p-payload",
          },
        },
        {
          id: "event-report",
          event_type: "report_viewed",
          occurred_at: "2026-08-02T22:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: { report_id: "r-direct" },
        },
        {
          id: "event-export-file",
          event_type: "export_downloaded",
          occurred_at: "2026-08-02T21:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: { export_id: "e-lookup" },
        },
        {
          id: "event-export-report",
          event_type: "export_downloaded",
          occurred_at: "2026-08-02T20:00:00.000Z",
          problem_id: null,
          submission_id: null,
          payload: { source_type: "report", source_id: "r-source" },
        },
        {
          id: "event-duplicate",
          event_type: "feedback_viewed",
          occurred_at: "2026-08-02T19:00:00.000Z",
          problem_id: "p-event",
          submission_id: "s-direct",
          payload: { submission_id: "s-payload", problem_id: "p-payload" },
        },
      ];

  function responseFor(record: QueryRecord) {
    const step =
      record.table === "writing_submissions"
        ? record.select === SAVED_SUBMISSION_SELECT
          ? "saved submissions"
          : record.select === ALL_SUBMISSION_SELECT
            ? "all submissions"
            : "timeline submissions"
        : record.table === "feedback_dimension_scores"
          ? "dimension scores"
          : record.table.replaceAll("_", " ");
    if (failAt === step) return { data: null, error };

    if (record.table === "library_items") {
      return { data: libraryItems, error: null };
    }
    if (record.table === "writing_submissions") {
      if (record.select === SAVED_SUBMISSION_SELECT) {
        return {
          data: empty
            ? []
            : [
                {
                  id: "s-saved-b",
                  problem_id: "p-saved-b",
                  question_no: 53,
                  char_count: 230,
                  submitted_at: "2026-08-03T00:00:00.000Z",
                  feedback_status: "complete",
                  parent_submission_id: null,
                },
                {
                  id: "s-saved-a",
                  problem_id: "p-saved-a",
                  question_no: 54,
                  char_count: 620,
                  submitted_at: "2026-08-02T00:00:00.000Z",
                  feedback_status: "complete",
                  parent_submission_id: null,
                },
              ],
          error: null,
        };
      }
      if (record.select === ALL_SUBMISSION_SELECT) {
        return { data: [], error: null };
      }
      return {
        data: [
          ["s-direct", "p-timeline-direct", 51],
          ["s-payload", "p-timeline-payload", 52],
          ["s-report-direct", "p-timeline-report", 53],
          ["s-report-export", "p-timeline-export", 54],
          ["s-report-source", "p-timeline-source", 54],
        ].map(([id, problem_id, question_no]) => ({
          id,
          problem_id,
          question_no,
        })),
        error: null,
      };
    }
    if (record.table === "study_events") {
      return { data: studyEvents, error: null };
    }
    if (record.table === "export_files") {
      return {
        data: [
          { id: "e-lookup", source_type: "report", source_id: "r-export" },
        ],
        error: null,
      };
    }
    if (record.table === "comparison_reports") {
      return {
        data: [
          { id: "r-direct", current_submission_id: "s-report-direct" },
          { id: "r-source", current_submission_id: "s-report-source" },
          { id: "r-export", current_submission_id: "s-report-export" },
        ],
        error: null,
      };
    }
    if (record.table === "problems") {
      return {
        data: [
          {
            id: "p-library",
            question_no: 51,
            title: "Visible non-writing",
            difficulty: 2,
            publish_status: "published",
            visibility: "public",
            lifecycle_status: "active",
          },
          {
            id: "p-event",
            question_no: 52,
            title: "Hidden non-writing",
            difficulty: 2,
            publish_status: "archived",
            visibility: "public",
            lifecycle_status: "inactive",
          },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  }

  const client = {
    from(table: string) {
      const record: QueryRecord = {
        kind: "table",
        table,
        select: null,
        operations: [],
      };
      records.push(record);
      const chain = {
        select(columns: string) {
          record.select = columns;
          record.operations.push({ name: "select", args: [columns] });
          return chain;
        },
        eq(...args: unknown[]) {
          record.operations.push({ name: "eq", args });
          return chain;
        },
        neq(...args: unknown[]) {
          record.operations.push({ name: "neq", args });
          return chain;
        },
        in(...args: unknown[]) {
          record.operations.push({ name: "in", args });
          return chain;
        },
        order(...args: unknown[]) {
          record.operations.push({ name: "order", args });
          return chain;
        },
        limit(...args: unknown[]) {
          record.operations.push({ name: "limit", args });
          return chain;
        },
        then(
          onfulfilled?: Parameters<Promise<unknown>["then"]>[0],
          onrejected?: Parameters<Promise<unknown>["then"]>[1],
        ) {
          return Promise.resolve(responseFor(record)).then(
            onfulfilled,
            onrejected,
          );
        },
      };
      return chain;
    },
    rpc(name: string, args: unknown) {
      records.push({ kind: "rpc", name, args });
      const step =
        name === "get_writing_submission_history_context"
          ? "submission history"
          : "canonical";
      if (failAt === step) return Promise.resolve({ data: null, error });
      if (name === "get_available_writing_questions") {
        return Promise.resolve({
          data: [
            canonicalRow("p-saved-b", 53),
            canonicalRow("p-saved-a"),
            canonicalRow("p-payload", 52),
            canonicalRow("p-timeline-direct", 51),
            canonicalRow("p-timeline-payload", 52),
            canonicalRow("p-timeline-report", 53),
            canonicalRow("p-timeline-export"),
            canonicalRow("p-timeline-source"),
            canonicalRow("p-out-of-scope"),
          ],
          error: null,
        });
      }
      return Promise.resolve({
        data: (args as { p_submission_ids: string[] }).p_submission_ids.map(
          (submission_id) => ({
            submission_id,
            title: `History ${submission_id}`,
          }),
        ),
        error: null,
      });
    },
  };

  return { client, records };
}

function tableRecord(records: Record[], table: string, select: string) {
  return records.find(
    (record): record is QueryRecord =>
      record.kind === "table" &&
      record.table === table &&
      record.select === select,
  );
}

describe("queryLibraryDashboardRows", () => {
  it("preserves query clauses, stages, and timeline ID insertion order", async () => {
    const { client, records } = makeRecorder();

    const rows = await queryLibraryDashboardRows(
      "user-1",
      async () => client as never,
    );

    expect(
      records.map((record) =>
        record.kind === "table" ? record.table : `rpc:${record.name}`,
      ),
    ).toEqual([
      "library_items",
      "writing_submissions",
      "writing_feedback",
      "feedback_dimension_scores",
      "writing_submissions",
      "study_events",
      "rpc:get_writing_submission_history_context",
      "export_files",
      "comparison_reports",
      "writing_submissions",
      "rpc:get_writing_submission_history_context",
      "problems",
      "rpc:get_available_writing_questions",
    ]);

    expect(
      tableRecord(
        records,
        "library_items",
        "id, item_type, problem_id, saved_at, submission_id",
      )?.operations,
    ).toEqual([
      {
        name: "select",
        args: ["id, item_type, problem_id, saved_at, submission_id"],
      },
      { name: "eq", args: ["user_id", "user-1"] },
      { name: "order", args: ["saved_at", { ascending: false }] },
    ]);
    expect(
      tableRecord(
        records,
        "writing_submissions",
        SAVED_SUBMISSION_SELECT,
      )?.operations.at(-1),
    ).toEqual({
      name: "in",
      args: ["id", ["s-saved-b", "s-saved-a"]],
    });
    expect(
      tableRecord(
        records,
        "writing_feedback",
        "submission_id, status, score_total, score_max, generated_at",
      )?.operations.at(-1),
    ).toEqual({
      name: "in",
      args: ["submission_id", ["s-saved-b", "s-saved-a"]],
    });
    expect(
      tableRecord(
        records,
        "feedback_dimension_scores",
        "id, submission_id, dimension, score, score_max, summary, weakness_level",
      )?.operations.at(-1),
    ).toEqual({
      name: "in",
      args: ["submission_id", ["s-saved-b", "s-saved-a"]],
    });
    expect(
      tableRecord(records, "writing_submissions", ALL_SUBMISSION_SELECT)
        ?.operations,
    ).toEqual([
      { name: "select", args: [ALL_SUBMISSION_SELECT] },
      { name: "eq", args: ["user_id", "user-1"] },
      { name: "order", args: ["submitted_at", { ascending: false }] },
      { name: "limit", args: [500] },
    ]);
    expect(
      tableRecord(
        records,
        "study_events",
        "id, event_type, occurred_at, problem_id, submission_id, payload",
      )?.operations,
    ).toEqual([
      {
        name: "select",
        args: [
          "id, event_type, occurred_at, problem_id, submission_id, payload",
        ],
      },
      { name: "eq", args: ["user_id", "user-1"] },
      {
        name: "in",
        args: [
          "event_type",
          [
            "submission_submitted",
            "feedback_viewed",
            "report_viewed",
            "export_downloaded",
          ],
        ],
      },
      { name: "order", args: ["occurred_at", { ascending: false }] },
      { name: "limit", args: [12] },
    ]);
    expect(
      tableRecord(
        records,
        "export_files",
        "id, source_type, source_id",
      )?.operations.at(-1),
    ).toEqual({
      name: "in",
      args: ["id", ["e-lookup"]],
    });
    expect(
      tableRecord(
        records,
        "comparison_reports",
        "id, current_submission_id",
      )?.operations.at(-1),
    ).toEqual({
      name: "in",
      args: ["id", ["r-direct", "r-source", "r-export"]],
    });
    expect(
      tableRecord(
        records,
        "writing_submissions",
        TIMELINE_SUBMISSION_SELECT,
      )?.operations.at(-1),
    ).toEqual({
      name: "in",
      args: [
        "id",
        [
          "s-direct",
          "s-payload",
          "s-report-direct",
          "s-report-export",
          "s-report-source",
        ],
      ],
    });
    expect(
      tableRecord(
        records,
        "problems",
        "id, question_no, title, difficulty, publish_status, visibility, lifecycle_status",
      )?.operations.slice(-2),
    ).toEqual([
      {
        name: "in",
        args: [
          "id",
          [
            "p-saved-b",
            "p-saved-a",
            "p-library",
            "p-event",
            "p-payload",
            "p-timeline-direct",
            "p-timeline-payload",
            "p-timeline-report",
            "p-timeline-export",
            "p-timeline-source",
          ],
        ],
      },
      { name: "neq", args: ["domain", "writing"] },
    ]);
    expect(
      records
        .filter(
          (record): record is RpcRecord =>
            record.kind === "rpc" &&
            record.name === "get_writing_submission_history_context",
        )
        .map((record) => record.args),
    ).toEqual([
      { p_submission_ids: ["s-saved-b", "s-saved-a"] },
      {
        p_submission_ids: [
          "s-direct",
          "s-payload",
          "s-report-direct",
          "s-report-export",
          "s-report-source",
        ],
      },
    ]);
    expect(
      records.find(
        (record): record is RpcRecord =>
          record.kind === "rpc" &&
          record.name === "get_available_writing_questions",
      )?.args,
    ).toEqual({ p_item_number: null, p_problem_id: null });
    expect(rows.problems.map((problem) => problem.id)).toEqual([
      "p-library",
      "p-event",
      "p-saved-b",
      "p-saved-a",
      "p-payload",
      "p-timeline-direct",
      "p-timeline-payload",
      "p-timeline-report",
      "p-timeline-export",
      "p-timeline-source",
    ]);
    expect(rows.visibleProblemIds).toEqual([
      "p-saved-b",
      "p-saved-a",
      "p-payload",
      "p-timeline-direct",
      "p-timeline-payload",
      "p-timeline-report",
      "p-timeline-export",
      "p-timeline-source",
      "p-library",
    ]);
  });

  it("skips ID-dependent optional queries when there are no IDs", async () => {
    const { client, records } = makeRecorder({ empty: true });

    const rows = await queryLibraryDashboardRows(
      "user-empty",
      async () => client as never,
    );

    expect(
      records.map((record) =>
        record.kind === "table" ? record.table : `rpc:${record.name}`,
      ),
    ).toEqual(["library_items", "writing_submissions", "study_events"]);
    expect(rows).toEqual({
      libraryItems: [],
      submissions: [],
      feedback: [],
      dimensionScores: [],
      problems: [],
      allSubmissions: [],
      timelineSubmissions: [],
      studyEvents: [],
      comparisonReports: [],
      exportFiles: [],
      visibleProblemIds: [],
    });
  });

  it.each([
    ["library items", "getLibraryDashboard(library_items): boom"],
    ["saved submissions", "getLibraryDashboard(writing_submissions): boom"],
    ["writing feedback", "getLibraryDashboard(writing_feedback): boom"],
    [
      "dimension scores",
      "getLibraryDashboard(feedback_dimension_scores): boom",
    ],
    ["all submissions", "getLibraryDashboard(all writing_submissions): boom"],
    ["study events", "getLibraryDashboard(study_events): boom"],
    ["export files", "getLibraryDashboard(export_files): boom"],
    ["comparison reports", "getLibraryDashboard(comparison_reports): boom"],
    [
      "timeline submissions",
      "getLibraryDashboard(timeline writing_submissions): boom",
    ],
    ["submission history", "getLibraryDashboard(submission history): boom"],
    ["problems", "getLibraryDashboard(non-writing problems): boom"],
  ])("preserves the %s error message", async (failAt, message) => {
    const { client } = makeRecorder({ failAt });

    await expect(
      queryLibraryDashboardRows("user-1", async () => client as never),
    ).rejects.toThrow(message);
  });
});
