import { describe, expect, it } from "vitest";
import { listLibraryItems } from "../../../src/lib/library/server";
import { REPORT_NARRATIVE_EXCERPT_LEN } from "../../../src/lib/library/types";

type FromResult = {
  data?: unknown[] | null;
  error?: { message: string } | null;
};

/**
 * Build a mock supabase server client that returns canned responses keyed
 * by the `from(table)` argument. Each table call resolves a thenable chain
 * matching the patterns used in `src/lib/library/server.ts`:
 *
 *   .from(t).select("*").eq("user_id", x).eq("item_type", y).order(...)
 *   .from(t).select(cols).in("id", ids)
 *
 * The returned chain is intentionally minimal — any unimplemented method
 * will throw at runtime to surface drift.
 */
function makeClient(
  byTable: Record<string, FromResult>,
  byRpc: Record<string, FromResult> = {},
) {
  return {
    from: (table: string) => {
      const result = byTable[table] ?? { data: [], error: null };
      const thenable = Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
      });
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => thenable,
        then: thenable.then.bind(thenable),
        catch: thenable.catch.bind(thenable),
        finally: thenable.finally.bind(thenable),
      };
      return chain;
    },
    rpc: (fn: string) => {
      const result =
        byRpc[fn] ??
        (fn === "list_user_library_problem_items"
          ? defaultProblemAvailabilityRpc(byTable)
          : { data: [], error: null });
      return Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
      });
    },
  };
}

function defaultProblemAvailabilityRpc(
  byTable: Record<string, FromResult>,
): FromResult {
  const items = byTable.library_items?.data ?? [];
  const problems = byTable.problems?.data ?? [];
  const problemById = new Map(
    problems.map((row) => {
      const problem = row as { id?: string };
      return [problem.id, problem];
    }),
  );
  return {
    data: items.flatMap((row) => {
      const item = row as {
        id?: string;
        problem_id?: string | null;
        tags?: string[] | null;
        saved_at?: string;
      };
      if (!item.problem_id) return [];
      const problem = problemById.get(item.problem_id) as
        | { title?: string | null; question_no?: number | null }
        | undefined;
      if (!problem) return [];
      return [
        {
          item_id: item.id,
          problem_id: item.problem_id,
          title: problem.title ?? null,
          question_no: problem.question_no ?? null,
          tags: item.tags ?? [],
          saved_at: item.saved_at,
          availability_status: "available",
          availability_reason: null,
          can_retry: true,
        },
      ];
    }),
  };
}

describe("listLibraryItems(submissions)", () => {
  it("joins library_items rows with writing_submissions", async () => {
    const items = [
      {
        id: "li-1",
        user_id: "u",
        item_type: "submission",
        attempt_id: null,
        submission_id: "sub-1",
        report_id: null,
        export_id: null,
        problem_id: null,
        note: null,
        tags: ["essay"],
        saved_at: "2026-05-21T00:00:00Z",
      },
      {
        id: "li-2",
        user_id: "u",
        item_type: "submission",
        attempt_id: null,
        submission_id: "sub-2",
        report_id: null,
        export_id: null,
        problem_id: null,
        note: null,
        tags: [],
        saved_at: "2026-05-20T00:00:00Z",
      },
    ];
    const subs = [
      {
        id: "sub-1",
        problem_id: "p-1",
        question_no: 53,
        submitted_at: "2026-05-21T01:00:00Z",
        char_count: 412,
      },
      {
        id: "sub-2",
        problem_id: "p-2",
        submitted_at: "2026-05-20T01:00:00Z",
        char_count: 305,
      },
    ];
    const create = async () =>

      makeClient({
        library_items: { data: items },
        writing_submissions: { data: subs },
        problems: {
          data: [
            { id: "p-1", title: "Problem 1" },
            { id: "p-2", title: "Problem 2" },
          ],
        },
      }) as never;

    const out = await listLibraryItems("u", "submissions", create);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      kind: "submission",
      id: "sub-1",
      problem_id: "p-1",
      problem_title: "Problem 1",
      question_no: 53,
      submitted_at: "2026-05-21T01:00:00Z",
      char_count: 412,
      item_id: "li-1",
      saved_at: "2026-05-21T00:00:00Z",
      tags: ["essay"],
    });
    expect(out[1].kind).toBe("submission");
  });

  it("returns empty array when no library_items exist", async () => {
    const create = async () =>
      makeClient({ library_items: { data: [] } }) as never;
    const out = await listLibraryItems("u", "submissions", create);
    expect(out).toEqual([]);
  });

  it("throws when supabase returns an error fetching library_items", async () => {
    const create = async () =>
      makeClient({
        library_items: { data: null, error: { message: "permission denied" } },
      }) as never;
    await expect(
      listLibraryItems("u", "submissions", create),
    ).rejects.toThrow(/permission denied/);
  });

  it("drops items whose underlying submission is not visible (RLS strip)", async () => {
    const items = [
      {
        id: "li-1",
        user_id: "u",
        item_type: "submission",
        attempt_id: null,
        submission_id: "sub-missing",
        report_id: null,
        export_id: null,
        problem_id: null,
        note: null,
        tags: [],
        saved_at: "2026-05-21T00:00:00Z",
      },
    ];
    const create = async () =>
      makeClient({
        library_items: { data: items },
        writing_submissions: { data: [] },
      }) as never;
    const out = await listLibraryItems("u", "submissions", create);
    expect(out).toEqual([]);
  });
});

describe("listLibraryItems(reports)", () => {
  it("returns excerpted narrative", async () => {
    const longNarrative = "x".repeat(200);
    const items = [
      {
        id: "li-r1",
        user_id: "u",
        item_type: "report",
        attempt_id: null,
        submission_id: null,
        report_id: "rep-1",
        export_id: null,
        problem_id: null,
        note: null,
        tags: ["weak-grammar"],
        saved_at: "2026-05-21T00:00:00Z",
      },
    ];
    const reports = [
      {
        id: "rep-1",
        generated_at: "2026-05-21T02:00:00Z",
        narrative: longNarrative,
      },
    ];
    const create = async () =>

      makeClient({
        library_items: { data: items },
        comparison_reports: { data: reports },
      }) as never;
    const out = await listLibraryItems("u", "reports", create);
    expect(out).toHaveLength(1);
    const first = out[0];
    expect(first.kind).toBe("report");
    if (first.kind === "report") {
      expect(first.id).toBe("rep-1");
      expect(first.narrative_excerpt?.length).toBeLessThanOrEqual(
        REPORT_NARRATIVE_EXCERPT_LEN + 3,
      );
      expect(first.narrative_excerpt?.endsWith("...")).toBe(true);
      expect(first.tags).toEqual(["weak-grammar"]);
    }
  });

  it("passes through null narrative", async () => {
    const items = [
      {
        id: "li-r2",
        user_id: "u",
        item_type: "report",
        attempt_id: null,
        submission_id: null,
        report_id: "rep-2",
        export_id: null,
        problem_id: null,
        note: null,
        tags: [],
        saved_at: "2026-05-20T00:00:00Z",
      },
    ];
    const create = async () =>

      makeClient({
        library_items: { data: items },
        comparison_reports: {
          data: [
            { id: "rep-2", generated_at: "2026-05-20T00:00:00Z", narrative: null },
          ],
        },
      }) as never;
    const out = await listLibraryItems("u", "reports", create);
    expect(out[0]).toMatchObject({
      kind: "report",
      narrative_excerpt: null,
    });
  });
});

describe("listLibraryItems(problems)", () => {
  it("returns available problem rows from the library availability RPC", async () => {
    const items = [
      {
        id: "li-p1",
        user_id: "u",
        item_type: "problem",
        attempt_id: null,
        submission_id: null,
        report_id: null,
        export_id: null,
        problem_id: "p-1",
        note: null,
        tags: ["bookmark"],
        saved_at: "2026-05-21T00:00:00Z",
      },
    ];
    const create = async () =>

      makeClient({
        library_items: { data: items },
        problems: {
          data: [{ id: "p-1", title: "TOPIK 53 — 도표 분석", question_no: 53 }],
        },
      }) as never;
    const out = await listLibraryItems("u", "problems", create);
    expect(out).toEqual([
      {
        kind: "problem",
        id: "p-1",
        title: "TOPIK 53 — 도표 분석",
        question_no: 53,
        item_id: "li-p1",
        saved_at: "2026-05-21T00:00:00Z",
        tags: ["bookmark"],
        availabilityStatus: "available",
        availabilityReason: null,
        canRetry: true,
      },
    ]);
  });

  it("keeps hard-unavailable saved problem rows without exposing problem metadata", async () => {
    const items = [
      {
        id: "li-p-hidden",
        user_id: "u",
        item_type: "problem",
        attempt_id: null,
        submission_id: null,
        report_id: null,
        export_id: null,
        problem_id: "p-hidden",
        note: null,
        tags: ["bookmark"],
        saved_at: "2026-05-21T00:00:00Z",
      },
    ];
    const create = async () =>

      makeClient({
        library_items: { data: items },
      }, {
        list_user_library_problem_items: {
          data: [
            {
              item_id: "li-p-hidden",
              problem_id: "p-hidden",
              title: null,
              question_no: null,
              tags: ["bookmark"],
              saved_at: "2026-05-21T00:00:00Z",
              availability_status: "hard_unavailable",
              availability_reason: null,
              can_retry: false,
            },
          ],
        },
      }) as never;
    const out = await listLibraryItems("u", "problems", create);
    expect(out).toEqual([
      {
        kind: "problem",
        id: "p-hidden",
        title: null,
        question_no: null,
        item_id: "li-p-hidden",
        saved_at: "2026-05-21T00:00:00Z",
        tags: ["bookmark"],
        availabilityStatus: "hard_unavailable",
        availabilityReason: null,
        canRetry: false,
      },
    ]);
  });
});

describe("listLibraryItems(exports)", () => {
  it("returns export rows with options + status", async () => {
    const items = [
      {
        id: "li-e1",
        user_id: "u",
        item_type: "export",
        attempt_id: null,
        submission_id: null,
        report_id: null,
        export_id: "exp-1",
        problem_id: null,
        note: null,
        tags: [],
        saved_at: "2026-05-21T00:00:00Z",
      },
    ];
    const create = async () =>

      makeClient({
        library_items: { data: items },
        export_files: {
          data: [
            {
              id: "exp-1",
              source_type: "submission",
              storage_path: "browser-print://abc",
              status: "ready",
              options: { source: "browser_print" },
            },
          ],
        },
      }) as never;
    const out = await listLibraryItems("u", "exports", create);
    expect(out).toHaveLength(1);
    const first = out[0];
    expect(first.kind).toBe("export");
    if (first.kind === "export") {
      expect(first.source_type).toBe("submission");
      expect(first.status).toBe("ready");
      expect(first.options).toEqual({ source: "browser_print" });
    }
  });
});
