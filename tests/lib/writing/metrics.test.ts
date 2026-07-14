import { afterEach, describe, expect, it, vi } from "vitest";
import { recordWritingSubmissionMetrics } from "../../../src/lib/writing/metrics";

type InsertCall = {
  table: string;
  row: Record<string, unknown>;
};

function makeClient(opts: {
  user?: { id: string } | null;
  insertError?: { message: string } | null;
  onInsert?: (call: InsertCall) => void;
}) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: opts.user ?? null }, error: null }),
    },
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        opts.onInsert?.({ table, row });
        return Promise.resolve({
          data: null,
          error: opts.insertError ?? null,
        });
      },
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordWritingSubmissionMetrics: row shape", () => {
  it("inserts a numbers/ids-only row derived from the session user", async () => {
    const calls: InsertCall[] = [];
    await recordWritingSubmissionMetrics(
      {
        submissionId: "sub-1",
        problemId: "p-1",
        questionNo: 51,
        elapsedSeconds: 125,
        activeSeconds: 90,
        startedAt: "2026-07-08T01:02:03.000Z",
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("writing_submission_metrics");
    expect(calls[0].row).toEqual({
      submission_id: "sub-1",
      user_id: "user-1",
      problem_id: "p-1",
      question_no: 51,
      elapsed_seconds: 125,
      active_seconds: 90,
      started_at: "2026-07-08T01:02:03.000Z",
    });
  });

  it("never carries answer text — the input type has no content field", async () => {
    const calls: InsertCall[] = [];
    await recordWritingSubmissionMetrics(
      {
        submissionId: "sub-2",
        questionNo: 54,
        elapsedSeconds: 10,
        activeSeconds: 5,
        startedAt: "2026-07-08T01:02:03.000Z",
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    const keys = Object.keys(calls[0].row).sort();
    expect(keys).toEqual([
      "active_seconds",
      "elapsed_seconds",
      "problem_id",
      "question_no",
      "started_at",
      "submission_id",
      "user_id",
    ]);
  });
});

describe("recordWritingSubmissionMetrics: clamping (DB check constraints)", () => {
  it("clamps negative / non-finite / oversized values", async () => {
    const calls: InsertCall[] = [];
    await recordWritingSubmissionMetrics(
      {
        submissionId: "sub-3",
        questionNo: 52,
        elapsedSeconds: Number.POSITIVE_INFINITY,
        activeSeconds: -5,
        startedAt: "2026-07-08T01:02:03.000Z",
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls[0].row.elapsed_seconds).toBe(0);
    expect(calls[0].row.active_seconds).toBe(0);

    const more: InsertCall[] = [];
    await recordWritingSubmissionMetrics(
      {
        submissionId: "sub-4",
        questionNo: 53,
        elapsedSeconds: 100_000,
        activeSeconds: 99_999,
        startedAt: "2026-07-08T01:02:03.000Z",
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => more.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(more[0].row.elapsed_seconds).toBe(86_400);
    expect(more[0].row.active_seconds).toBe(86_400);
  });

  it("caps active_seconds at elapsed_seconds (DB check active <= elapsed)", async () => {
    const calls: InsertCall[] = [];
    await recordWritingSubmissionMetrics(
      {
        submissionId: "sub-5",
        questionNo: 51,
        elapsedSeconds: 30,
        activeSeconds: 45,
        startedAt: "2026-07-08T01:02:03.000Z",
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls[0].row.elapsed_seconds).toBe(30);
    expect(calls[0].row.active_seconds).toBe(30);
  });

  it("floors fractional seconds", async () => {
    const calls: InsertCall[] = [];
    await recordWritingSubmissionMetrics(
      {
        submissionId: "sub-6",
        questionNo: 51,
        elapsedSeconds: 12.9,
        activeSeconds: 3.2,
        startedAt: "2026-07-08T01:02:03.000Z",
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls[0].row.elapsed_seconds).toBe(12);
    expect(calls[0].row.active_seconds).toBe(3);
  });
});

describe("recordWritingSubmissionMetrics: fire-and-forget contract", () => {
  it("no-ops when there is no authenticated session", async () => {
    const calls: InsertCall[] = [];
    await expect(
      recordWritingSubmissionMetrics(
        {
          submissionId: "sub-7",
          questionNo: 51,
          elapsedSeconds: 10,
          activeSeconds: 5,
          startedAt: "2026-07-08T01:02:03.000Z",
        },
        () =>
          makeClient({
            user: null,
            onInsert: (c) => calls.push(c),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("swallows insert errors (e.g. duplicate submission_id on retry)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        recordWritingSubmissionMetrics(
          {
            submissionId: "sub-8",
            questionNo: 51,
            elapsedSeconds: 10,
            activeSeconds: 5,
            startedAt: "2026-07-08T01:02:03.000Z",
          },
          () =>
            makeClient({
              user: { id: "user-1" },
              insertError: { message: "duplicate key value" },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any,
        ),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("swallows unexpected errors from the client factory", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        recordWritingSubmissionMetrics(
          {
            submissionId: "sub-9",
            questionNo: 51,
            elapsedSeconds: 10,
            activeSeconds: 5,
            startedAt: "2026-07-08T01:02:03.000Z",
          },
          () => {
            throw new Error("client construction blew up");
          },
        ),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
