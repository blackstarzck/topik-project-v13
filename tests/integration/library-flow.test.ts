import { describe, it, expect, vi } from "vitest";

// Phase 6 integration: library-flow
// - listLibraryItems honors the tab discriminator
// - saveLibraryItem surfaces the RLS rejection when a user tries to save
//   someone else's submission_id (Phase 6 P1-5)
// - triggerPdfExport stamps the browser_print marker

import {
  isSubmissionSavedToLibrary,
  listLibraryItems,
} from "@/lib/library/server";
import { saveLibraryItem } from "@/lib/library/mutations";
import { triggerPdfExport } from "@/lib/export/pdf-export";

function makeClient(opts: {
  libraryRows?: unknown[];
  joinRows?: Record<string, unknown[]>;
  insertError?: { code?: string; message: string } | null;
}) {
  const inserted: Array<{ table: string; row: unknown }> = [];
  const calls: string[] = [];
  return {
    inserted,
    calls,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      })),
    },
    from: (table: string) => {
      calls.push(`from:${table}`);
      if (table === "library_items") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: opts.libraryRows ?? [],
                    error: null,
                  }),
              }),
            }),
          }),
          insert: (row: unknown) => {
            inserted.push({ table, row });
            if (opts.insertError) {
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({ data: null, error: opts.insertError }),
                }),
              };
            }
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { ...(row as object), id: "new-lib-id" },
                    error: null,
                  }),
              }),
            };
          },
        };
      }
      if (opts.joinRows && opts.joinRows[table]) {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({ data: opts.joinRows![table], error: null }),
          }),
        };
      }
      if (table === "export_files") {
        return {
          insert: (row: unknown) => {
            inserted.push({ table, row });
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { ...(row as object), id: "exp-1" },
                    error: null,
                  }),
              }),
            };
          },
        };
      }
      if (table === "study_events") {
        return {
          insert: (row: unknown) => {
            inserted.push({ table, row });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  };
}

function makeLibrarySavedLookupClient(opts: {
  data?: { id: string } | null;
  error?: { message: string } | null;
}) {
  const maybeSingle = vi.fn(() =>
    Promise.resolve({
      data: opts.data ?? null,
      error: opts.error ?? null,
    }),
  );
  const eqSubmissionId = vi.fn(() => ({ maybeSingle }));
  const eqItemType = vi.fn(() => ({ eq: eqSubmissionId }));
  const eqUserId = vi.fn(() => ({ eq: eqItemType }));
  const select = vi.fn(() => ({ eq: eqUserId }));
  const from = vi.fn((table: string) => {
    expect(table).toBe("library_items");
    return { select };
  });

  return {
    client: { from },
    select,
    eqUserId,
    eqItemType,
    eqSubmissionId,
    maybeSingle,
  };
}

describe("library-flow — listLibraryItems shape", () => {
  it("returns empty array for new user (all tabs)", async () => {
    const client = makeClient({});
    const items = await listLibraryItems(
      "user-1",
      "submissions",
      async () => client as never,
    );
    expect(items).toEqual([]);
  });

  it("returns submission-kind views for the submissions tab", async () => {
    const client = makeClient({
      libraryRows: [
        {
          id: "lib-1",
          user_id: "user-1",
          item_type: "submission",
          submission_id: "sub-1",
          attempt_id: null,
          report_id: null,
          export_id: null,
          problem_id: null,
          note: null,
          tags: ["t1"],
          saved_at: "2026-05-22T00:00:00Z",
        },
      ],
      joinRows: {
        writing_submissions: [
          {
            id: "sub-1",
            problem_id: "p-1",
            submitted_at: "2026-05-22T00:00:00Z",
            char_count: 200,
          },
        ],
      },
    });
    const items = await listLibraryItems(
      "user-1",
      "submissions",
      async () => client as never,
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("submission");
  });
});

describe("library-flow feedback save state lookup", () => {
  it("returns true when the submission already has a library item", async () => {
    const lookup = makeLibrarySavedLookupClient({ data: { id: "lib-1" } });

    const saved = await isSubmissionSavedToLibrary(
      "user-1",
      "sub-1",
      async () => lookup.client as never,
    );

    expect(saved).toBe(true);
    expect(lookup.select).toHaveBeenCalledWith("id");
    expect(lookup.eqUserId).toHaveBeenCalledWith("user_id", "user-1");
    expect(lookup.eqItemType).toHaveBeenCalledWith("item_type", "submission");
    expect(lookup.eqSubmissionId).toHaveBeenCalledWith(
      "submission_id",
      "sub-1",
    );
    expect(lookup.maybeSingle).toHaveBeenCalled();
  });

  it("returns false when the submission has no library item yet", async () => {
    const lookup = makeLibrarySavedLookupClient({ data: null });

    await expect(
      isSubmissionSavedToLibrary(
        "user-1",
        "sub-1",
        async () => lookup.client as never,
      ),
    ).resolves.toBe(false);
  });
});

describe("library-flow — RLS rejection on cross-user save", () => {
  it("propagates the RLS row-level security error verbatim", async () => {
    const client = makeClient({
      insertError: {
        code: "42501",
        message:
          'new row violates row-level security policy for table "library_items"',
      },
    });
    await expect(
      saveLibraryItem(
        {
          user_id: "user-1",
          item_type: "submission",
          submission_id: "someone-elses-id",
        },
        () => client as never,
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("library-flow — browser_print marker", () => {
  it("triggerPdfExport stamps options.source='browser_print' on submission rows", async () => {
    const client = makeClient({});
    // window stub for SSR-style vitest env
    if (typeof window === "undefined") {
      (globalThis as { window?: unknown }).window = {
        print: vi.fn(),
      } as never;
    }
    const result = await triggerPdfExport(
      { sourceType: "submission", sourceId: "sub-1" },
      () => client as never,
    );
    expect(result.exportId).toBeTruthy();
    const exportInsert = client.inserted.find(
      (i) => i.table === "export_files",
    );
    expect(exportInsert).toBeTruthy();
    const row = exportInsert!.row as { options: unknown; storage_path: string };
    expect((row.options as { source: string }).source).toBe("browser_print");
    expect(row.storage_path).toMatch(/^browser-print:\/\//);
  });

  it("triggerPdfExport rejects library_selection with non-null sourceId", async () => {
    const client = makeClient({});
    await expect(
      triggerPdfExport(
        { sourceType: "library_selection", sourceId: "not-null" } as never,
        () => client as never,
      ),
    ).rejects.toThrow();
  });
});
