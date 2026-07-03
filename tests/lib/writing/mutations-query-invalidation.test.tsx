// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUpsertDraft } from "../../../src/lib/writing/mutations";
import { draftQueryKey } from "../../../src/lib/writing/queries";
import type {
  WritingDraftInsert,
  WritingDraftRow,
} from "../../../src/lib/writing/types";

const browserClientState = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => browserClientState.client,
}));

const INPUT: WritingDraftInsert = {
  user_id: "user-1",
  problem_id: "problem-1",
  question_no: 51,
  answer_text: "draft answer",
  answer_json: null,
  char_count: 12,
  autosave_status: "clean",
  last_saved_at: "2026-06-26T00:00:00.000Z",
};

const PROBLEM_LIST_QUERY_KEY = [
  "list-user-problems-rpc",
  {
    filter: {},
    sort: "newest",
    page: 1,
    pageSize: 10,
    userId: "user-1",
  },
] as const;

function makeRow(input: WritingDraftInsert): WritingDraftRow {
  return {
    id: "draft-1",
    user_id: input.user_id,
    problem_id: input.problem_id,
    question_no: input.question_no,
    answer_text: input.answer_text ?? null,
    answer_json: input.answer_json ?? null,
    char_count: input.char_count ?? null,
    autosave_status: input.autosave_status ?? "clean",
    last_saved_at: input.last_saved_at ?? null,
    created_at: "2026-06-26T00:00:00.000Z",
    updated_at: "2026-06-26T00:00:00.000Z",
  };
}

function makeInsertClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            neq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
      insert: (payload: WritingDraftInsert) => ({
        select: () => ({
          single: async () => ({ data: makeRow(payload), error: null }),
        }),
      }),
    }),
  };
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  cleanup();
  browserClientState.client = null;
});

describe("useUpsertDraft query invalidation", () => {
  it("invalidates the problem list after saving a draft so back navigation reloads solve state", async () => {
    browserClientState.client = makeInsertClient();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(draftQueryKey(INPUT.user_id, INPUT.problem_id), {
      stale: "draft",
    });
    queryClient.setQueryData(PROBLEM_LIST_QUERY_KEY, {
      rows: [{ problemId: INPUT.problem_id, solveState: "none" }],
      total: 1,
    });

    const problemListQuery = queryClient
      .getQueryCache()
      .find({ queryKey: PROBLEM_LIST_QUERY_KEY });
    expect(problemListQuery?.state.isInvalidated).toBe(false);

    const { result } = renderHook(() => useUpsertDraft(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync(INPUT);

    await waitFor(() => {
      expect(
        queryClient.getQueryCache().find({ queryKey: PROBLEM_LIST_QUERY_KEY })
          ?.state.isInvalidated,
      ).toBe(true);
    });
  });
});
