import { describe, expect, it, vi } from "vitest";
import {
  deleteProblemLibraryItem,
  deleteLibraryItem,
  isDuplicateLibrarySaveError,
  saveLibraryItem,
  updateItemTags,
} from "../../../src/lib/library/mutations";
import type { LibraryItemInsert } from "../../../src/lib/library/types";

type InsertResult = {
  data?: Record<string, unknown> | null;
  error?: { code?: string; details?: string | null; message: string } | null;
};

function makeInsertClient(table: string, opts: InsertResult) {
  const insert = vi.fn(() => ({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: opts.data ?? null,
          error: opts.error ?? null,
        }),
    }),
  }));
  const from = vi.fn((arg: string) => {
    expect(arg).toBe(table);
    return { insert };
  });
  return { client: { from }, insert, from };
}

function makeDeleteClient(opts: { error?: { message: string } | null }) {
  const eq = vi.fn(() =>
    Promise.resolve({ data: null, error: opts.error ?? null }),
  );
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return { client: { from }, del, eq, from };
}

function makeProblemDeleteClient(opts: { error?: { message: string } | null }) {
  const filters: Array<[string, unknown]> = [];
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      if (column === "problem_id") {
        return Promise.resolve({ data: null, error: opts.error ?? null });
      }
      return builder;
    }),
  };
  const del = vi.fn(() => builder);
  const from = vi.fn(() => ({ delete: del }));
  return { client: { from }, del, eq: builder.eq, filters, from };
}

function makeUpdateClient(opts: InsertResult) {
  const single = vi.fn(() =>
    Promise.resolve({
      data: opts.data ?? null,
      error: opts.error ?? null,
    }),
  );
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { client: { from }, update, eq, from };
}

const SUBMISSION_INSERT: LibraryItemInsert = {
  user_id: "user-1",
  item_type: "submission",
  submission_id: "sub-1",
  tags: ["bookmark"],
};

describe("saveLibraryItem", () => {
  it("inserts into library_items and returns the row", async () => {
    const row = {
      id: "li-1",
      user_id: "user-1",
      item_type: "submission",
      submission_id: "sub-1",
      attempt_id: null,
      report_id: null,
      export_id: null,
      problem_id: null,
      note: null,
      tags: ["bookmark"],
      saved_at: "2026-05-22T00:00:00Z",
    };
    const { client, from, insert } = makeInsertClient("library_items", {
      data: row,
    });
    const result = await saveLibraryItem(
      SUBMISSION_INSERT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => client as any,
    );
    expect(from).toHaveBeenCalledWith("library_items");
    expect(insert).toHaveBeenCalledWith(SUBMISSION_INSERT);
    expect(result.id).toBe("li-1");
  });

  it("surfaces RLS rejection when user tries to save someone else's submission", async () => {
    // Phase 6 RLS (library_items_owner_insert) verifies FK ownership: a row
    // referencing another user's submission is rejected with code 42501
    // (insufficient privilege). We simulate Supabase surfacing that as an
    // error payload — the mutation must propagate it intact.
    const { client } = makeInsertClient("library_items", {
      data: null,
      error: {
        message:
          'new row violates row-level security policy for table "library_items"',
      },
    });
    await expect(
      saveLibraryItem(
        {
          user_id: "user-1",
          item_type: "submission",
          submission_id: "other-user-sub",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => client as any,
      ),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/row-level security/),
    });
  });

  it("throws when supabase returns no row + no error", async () => {
    const { client } = makeInsertClient("library_items", { data: null });
    await expect(
      saveLibraryItem(
        SUBMISSION_INSERT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => client as any,
      ),
    ).rejects.toThrow(/empty row/);
  });
});

describe("isDuplicateLibrarySaveError", () => {
  it("recognizes duplicate submission saves from the library unique index", () => {
    expect(
      isDuplicateLibrarySaveError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "library_items_user_submission_uniq"',
        details: "Key (user_id, submission_id)=(user-1, sub-1) already exists.",
      }),
    ).toBe(true);
  });

  it("recognizes duplicate problem saves from the library unique index", () => {
    expect(
      isDuplicateLibrarySaveError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "library_items_user_problem_uniq"',
        details: "Key (user_id, problem_id)=(user-1, problem-1) already exists.",
      }),
    ).toBe(true);
  });

  it("does not treat unrelated unique violations as saved library items", () => {
    expect(
      isDuplicateLibrarySaveError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "profiles_nickname_lower_uniq"',
      }),
    ).toBe(false);
  });
});

describe("deleteLibraryItem", () => {
  it("deletes by id", async () => {
    const { client, from, del, eq } = makeDeleteClient({ error: null });
    await deleteLibraryItem(
      "li-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => client as any,
    );
    expect(from).toHaveBeenCalledWith("library_items");
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "li-1");
  });

  it("throws on supabase error", async () => {
    const { client } = makeDeleteClient({
      error: { message: "not found" },
    });
    await expect(
      deleteLibraryItem(
        "li-1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => client as any,
      ),
    ).rejects.toMatchObject({ message: "not found" });
  });
});

describe("deleteProblemLibraryItem", () => {
  it("deletes a saved problem by owner and problem identity", async () => {
    const { client, from, del, filters } = makeProblemDeleteClient({
      error: null,
    });
    await deleteProblemLibraryItem(
      { user_id: "user-1", problem_id: "problem-1" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => client as any,
    );

    expect(from).toHaveBeenCalledWith("library_items");
    expect(del).toHaveBeenCalled();
    expect(filters).toEqual([
      ["user_id", "user-1"],
      ["item_type", "problem"],
      ["problem_id", "problem-1"],
    ]);
  });

  it("throws on supabase error", async () => {
    const { client } = makeProblemDeleteClient({
      error: { message: "permission denied" },
    });

    await expect(
      deleteProblemLibraryItem(
        { user_id: "user-1", problem_id: "problem-1" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => client as any,
      ),
    ).rejects.toMatchObject({ message: "permission denied" });
  });
});

describe("updateItemTags", () => {
  it("updates tags array", async () => {
    const row = {
      id: "li-1",
      user_id: "user-1",
      item_type: "submission",
      submission_id: "sub-1",
      attempt_id: null,
      report_id: null,
      export_id: null,
      problem_id: null,
      note: null,
      tags: ["new-tag"],
      saved_at: "2026-05-22T00:00:00Z",
    };
    const { client, from, update, eq } = makeUpdateClient({ data: row });
    const result = await updateItemTags(
      "li-1",
      ["new-tag"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => client as any,
    );
    expect(from).toHaveBeenCalledWith("library_items");
    expect(update).toHaveBeenCalledWith({ tags: ["new-tag"] });
    expect(eq).toHaveBeenCalledWith("id", "li-1");
    expect(result.tags).toEqual(["new-tag"]);
  });

  it("throws on supabase error", async () => {
    const { client } = makeUpdateClient({
      data: null,
      error: { message: "permission denied" },
    });
    await expect(
      updateItemTags(
        "li-1",
        ["x"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => client as any,
      ),
    ).rejects.toMatchObject({ message: "permission denied" });
  });
});
