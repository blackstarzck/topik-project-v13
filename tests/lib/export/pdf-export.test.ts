import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerPdfExport } from "../../../src/lib/export/pdf-export";

type InsertCall = {
  table: string;
  values: Record<string, unknown>;
};

type FakeClient = {
  __insertCalls: InsertCall[];
  __exportInsertResult: { data: { id: string } | null; error: unknown };
  __studyEventResult: { error: unknown };
  __getUserResult: {
    data: { user: { id: string } | null };
    error: unknown;
  };
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
};

function makeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  const insertCalls: InsertCall[] = [];
  const client: FakeClient = {
    __insertCalls: insertCalls,
    __exportInsertResult: { data: { id: "exp-1" }, error: null },
    __studyEventResult: { error: null },
    __getUserResult: {
      data: { user: { id: "user-1" } },
      error: null,
    },
    auth: {
      getUser: vi.fn(async () => client.__getUserResult),
    },
    from: vi.fn((table: string) => ({
      insert: (values: Record<string, unknown>) => {
        insertCalls.push({ table, values });
        if (table === "export_files") {
          return {
            select: () => ({
              single: async () => client.__exportInsertResult,
            }),
          };
        }
        // study_events: thenable that resolves to { error }
        return {
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(client.__studyEventResult).then(resolve),
          catch: () => {
            // noop — Promise.then() chain in helper handles errors
          },
        };
      },
    })),
    ...overrides,
  };
  return client;
}

const originalWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  // Default to a "browser-like" world for happy-path tests.
  // jsdom is not installed; we install a minimal stub on globalThis.window.
  (globalThis as { window?: { print: () => void } }).window = {
    print: () => undefined,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

describe("triggerPdfExport", () => {
  it("submission export inserts row with options.source='browser_print' and ready status", async () => {
    const client = makeClient();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      /* noop */
    });

    const result = await triggerPdfExport(
      { sourceType: "submission", sourceId: "sub-42" },
      () =>
        client as unknown as ReturnType<
          typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
        >,
    );

    expect(result.exportId).toBe("exp-1");
    const exportInsert = client.__insertCalls.find(
      (c) => c.table === "export_files",
    );
    expect(exportInsert).toBeTruthy();
    expect(exportInsert?.values).toMatchObject({
      user_id: "user-1",
      source_type: "submission",
      source_id: "sub-42",
      status: "ready",
      options: { source: "browser_print" },
    });
    expect(
      typeof exportInsert?.values.storage_path === "string" &&
        (exportInsert.values.storage_path as string).startsWith(
          "browser-print://",
        ),
    ).toBe(true);
    expect(typeof exportInsert?.values.ready_at).toBe("string");

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("library_selection requires sourceId === null (throws otherwise)", async () => {
    const client = makeClient();
    await expect(
      triggerPdfExport(
        { sourceType: "library_selection", sourceId: "should-be-null" },
        () =>
          client as unknown as ReturnType<
            typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
          >,
      ),
    ).rejects.toThrow(/source_id must be null/);
    // Insert must not have run.
    expect(client.__insertCalls).toHaveLength(0);
  });

  it("library_selection with null sourceId inserts row with source_id null", async () => {
    const client = makeClient();
    vi.spyOn(window, "print").mockImplementation(() => undefined);

    await triggerPdfExport(
      { sourceType: "library_selection", sourceId: null },
      () =>
        client as unknown as ReturnType<
          typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
        >,
    );

    const exportInsert = client.__insertCalls.find(
      (c) => c.table === "export_files",
    );
    expect(exportInsert?.values).toMatchObject({
      source_type: "library_selection",
      source_id: null,
      options: { source: "browser_print" },
    });
  });

  it("logs a study_events row with event_type='export_downloaded'", async () => {
    const client = makeClient();
    vi.spyOn(window, "print").mockImplementation(() => undefined);

    await triggerPdfExport(
      { sourceType: "report", sourceId: "rep-1" },
      () =>
        client as unknown as ReturnType<
          typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
        >,
    );

    // study_events insert is fire-and-forget — yield the microtask queue so
    // the un-awaited promise can flush before we assert.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const eventInsert = client.__insertCalls.find(
      (c) => c.table === "study_events",
    );
    expect(eventInsert).toBeTruthy();
    expect(eventInsert?.values).toMatchObject({
      user_id: "user-1",
      event_type: "export_downloaded",
      payload: { source_type: "report", source_id: "rep-1" },
    });
  });

  it("sets the submission_id column for submission download events", async () => {
    const client = makeClient();
    vi.spyOn(window, "print").mockImplementation(() => undefined);

    await triggerPdfExport(
      { sourceType: "submission", sourceId: "sub-1" },
      () =>
        client as unknown as ReturnType<
          typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
        >,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const eventInsert = client.__insertCalls.find(
      (c) => c.table === "study_events",
    );
    expect(eventInsert?.values).toMatchObject({
      event_type: "export_downloaded",
      submission_id: "sub-1",
      payload: { source_type: "submission", source_id: "sub-1" },
    });
  });

  it("calls window.print exactly once when running in a browser", async () => {
    const client = makeClient();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      /* noop */
    });

    await triggerPdfExport(
      { sourceType: "submission", sourceId: "sub-1" },
      () =>
        client as unknown as ReturnType<
          typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
        >,
    );

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("SSR safety: completes the DB insert even when window is undefined", async () => {
    delete (globalThis as { window?: unknown }).window;
    const client = makeClient();

    const result = await triggerPdfExport(
      { sourceType: "submission", sourceId: "sub-9" },
      () =>
        client as unknown as ReturnType<
          typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
        >,
    );

    expect(result.exportId).toBe("exp-1");
    const exportInsert = client.__insertCalls.find(
      (c) => c.table === "export_files",
    );
    expect(exportInsert).toBeTruthy();
    expect(exportInsert?.values).toMatchObject({
      source_type: "submission",
      source_id: "sub-9",
    });
    // window was undefined — function must not have thrown.
  });

  it("throws when supabase reports no authenticated user", async () => {
    const client = makeClient();
    client.__getUserResult = { data: { user: null }, error: null };

    await expect(
      triggerPdfExport(
        { sourceType: "submission", sourceId: "sub-1" },
        () =>
          client as unknown as ReturnType<
            typeof import("../../../src/lib/supabase/browser").createSupabaseBrowserClient
          >,
      ),
    ).rejects.toThrow(/not authenticated/);
  });
});
