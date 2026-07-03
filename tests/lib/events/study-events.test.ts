import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STUDY_EVENT_TYPES,
  assertSafePayload,
  logStudyEvent,
  type StudyEventType,
} from "../../../src/lib/events/study-events";

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

describe("StudyEventType catalog", () => {
  it("freezes the 8 event types from the migration", () => {
    expect(STUDY_EVENT_TYPES).toEqual([
      "practice_started",
      "attempt_submitted",
      "draft_autosaved",
      "submission_submitted",
      "feedback_viewed",
      "report_viewed",
      "recommendation_clicked",
      "export_downloaded",
    ]);
  });
});

describe("logStudyEvent: all 8 eventType values flow through", () => {
  for (const eventType of STUDY_EVENT_TYPES) {
    it(`inserts a row for "${eventType}"`, async () => {
      const calls: InsertCall[] = [];
      await logStudyEvent(
        { eventType },
        () =>
          makeClient({
            user: { id: "user-1" },
            onInsert: (c) => calls.push(c),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      );
      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe("study_events");
      expect(calls[0].row.event_type).toBe(eventType);
      expect(calls[0].row.user_id).toBe("user-1");
    });
  }
});

describe("logStudyEvent: row shape", () => {
  it("populates ID columns from input and nulls the rest", async () => {
    const calls: InsertCall[] = [];
    await logStudyEvent(
      {
        eventType: "feedback_viewed",
        submissionId: "sub-1",
        problemId: "p-1",
        sessionId: "sess-1",
        payload: { source: "library", rank: 2 },
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls[0].row).toEqual({
      user_id: "user-1",
      event_type: "feedback_viewed",
      problem_id: "p-1",
      submission_id: "sub-1",
      attempt_id: null,
      session_id: "sess-1",
      payload: { source: "library", rank: 2 },
    });
  });

  it("sets payload to null when not provided", async () => {
    const calls: InsertCall[] = [];
    await logStudyEvent(
      { eventType: "practice_started" },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls[0].row.payload).toBe(null);
  });
});

describe("logStudyEvent: PII guard (dev throws)", () => {
  it("throws when payload contains 'answer_text'", async () => {
    await expect(
      logStudyEvent(
        {
          eventType: "submission_submitted",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { answer_text: "secret content" } as any,
        },
        () =>
          makeClient({
            user: { id: "user-1" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it("throws when payload contains 'content'", async () => {
    await expect(
      logStudyEvent(
        {
          eventType: "submission_submitted",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { content: "any" } as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => makeClient({ user: { id: "user-1" } }) as any,
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it("throws when payload contains 'narrative'", async () => {
    await expect(
      logStudyEvent(
        {
          eventType: "report_viewed",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { narrative: "any" } as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => makeClient({ user: { id: "user-1" } }) as any,
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it("throws when a string payload value exceeds 200 chars", async () => {
    const long = "x".repeat(201);
    await expect(
      logStudyEvent(
        {
          eventType: "feedback_viewed",
          payload: { source_label: long },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => makeClient({ user: { id: "user-1" } }) as any,
      ),
    ).rejects.toThrow(/200/);
  });

  it("accepts a payload at the 200-char boundary", async () => {
    const at = "x".repeat(200);
    const calls: InsertCall[] = [];
    await logStudyEvent(
      {
        eventType: "feedback_viewed",
        payload: { source_label: at },
      },
      () =>
        makeClient({
          user: { id: "user-1" },
          onInsert: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls).toHaveLength(1);
  });

  it("rejects nested object values defensively", () => {
    expect(() =>
      assertSafePayload(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { meta: { nested: true } } as any,
      ),
    ).toThrow(/primitive/);
  });
});

describe("logStudyEvent: fire-and-forget contract", () => {
  it("swallows insert errors without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        logStudyEvent(
          { eventType: "practice_started" },
          () =>
            makeClient({
              user: { id: "user-1" },
              insertError: { message: "rls denied" },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any,
        ),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("no-ops when there is no authenticated session", async () => {
    const calls: InsertCall[] = [];
    await expect(
      logStudyEvent(
        { eventType: "practice_started" },
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

  it("swallows unexpected (non-guard) errors from the client factory", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        logStudyEvent({ eventType: "practice_started" }, () => {
          throw new Error("client construction blew up");
        }),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

// Sanity: type alias narrows to the literal union.
describe("type narrowing", () => {
  it("StudyEventType union contains exactly 8 members", () => {
    const set = new Set<StudyEventType>(STUDY_EVENT_TYPES);
    expect(set.size).toBe(8);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logStudyEvent — prod-safety sanitize (Codex post-impl P1 fix)", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("strips forbidden keys before insert when NODE_ENV=production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const inserts: InsertCall[] = [];
    const client = makeClient({
      user: { id: "user-1" },
      onInsert: (c) => inserts.push(c),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await logStudyEvent(
      {
        eventType: "submission_submitted",
        payload: {
          problem_id: "p-1",
          answer_text: "이건 누출되면 안 되는 글쓰기 본문",
          char_count: 200,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => client as any,
    );

    expect(warnSpy).toHaveBeenCalled();
    expect(inserts).toHaveLength(1);
    const inserted = inserts[0].row;
    expect(inserted.payload).toBeTruthy();
    const payload = inserted.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("answer_text");
    expect(payload.problem_id).toBe("p-1");
    expect(payload.char_count).toBe(200);
  });

  it("sets payload to null when sanitizer empties the object", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const inserts: InsertCall[] = [];
    const client = makeClient({
      user: { id: "user-1" },
      onInsert: (c) => inserts.push(c),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await logStudyEvent(
      {
        eventType: "feedback_viewed",
        payload: { answer_text: "only forbidden keys" },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => client as any,
    );

    expect(inserts).toHaveLength(1);
    expect(inserts[0].row.payload).toBe(null);
  });
});
