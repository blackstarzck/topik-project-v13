// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useSubmitWriting,
  useUpsertDraft,
} from "../../../src/lib/writing/mutations";
import type { SubmitWritingInput } from "../../../src/lib/writing/server-actions";
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
  canonical_question_id: "topik-writing-51-0001",
  canonical_import_id: 321,
  canonical_payload_hash: "payload-hash-321",
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
    canonical_question_id: input.canonical_question_id ?? null,
    canonical_import_id: input.canonical_import_id ?? null,
    canonical_payload_hash: input.canonical_payload_hash ?? null,
    question_snapshot: input.question_snapshot ?? null,
    legacy_cutover_snapshot: input.legacy_cutover_snapshot ?? null,
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
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
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

  it("does not delay the caller success callback while cache refresh is pending", async () => {
    browserClientState.client = makeInsertClient();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
      () => new Promise(() => undefined),
    );
    const callerSuccess = vi.fn();
    const { result } = renderHook(() => useUpsertDraft(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(INPUT, { onSuccess: callerSuccess });

    await waitFor(() => expect(callerSuccess).toHaveBeenCalledTimes(1));
  });

  it("consumes the one-shot fresh route after any successful draft persistence", async () => {
    browserClientState.client = makeInsertClient();
    window.history.replaceState(
      null,
      "",
      "/ko/writing/short-answer-writing-51?problem=problem-1&fresh=1",
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(() => useUpsertDraft(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync(INPUT);

    expect(window.location.pathname).toBe(
      "/ko/writing/short-answer-writing-51",
    );
    expect(window.location.search).toBe("?problem=problem-1");
  });
});

describe("useSubmitWriting intent lifecycle", () => {
  it("rotates the intent after a confirmed provider rejection", async () => {
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(
        ids[0] as `${string}-${string}-${string}-${string}-${string}`,
      )
      .mockReturnValueOnce(
        ids[1] as `${string}-${string}-${string}-${string}-${string}`,
      );
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("writing_submission_dispatch_failed"))
      .mockResolvedValueOnce({ submissionId: "submission-1" });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const input: SubmitWritingInput = {
      draft_id: "draft-1",
      problem_id: "problem-1",
      question_no: 54,
      answer_text: "answer",
      answer_json: null,
      char_count: 6,
      canonical_question_id: "topik-writing-54-0001",
      canonical_import_id: "701",
      canonical_payload_hash: "payload-hash-701",
    };
    const { result } = renderHook(() => useSubmitWriting(action), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync(input)).rejects.toThrow(
      "writing_submission_dispatch_failed",
    );
    await expect(result.current.mutateAsync(input)).resolves.toEqual({
      submissionId: "submission-1",
    });

    expect(
      action.mock.calls.map(([call]) => call.submission_intent_id),
    ).toEqual(ids);
  });

  it("retains the intent when provider acceptance is ambiguous", async () => {
    const intentId = "11111111-1111-4111-8111-111111111111";
    const randomUuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(intentId);
    const action = vi
      .fn()
      .mockRejectedValue(new Error("writing_submission_dispatch_ambiguous"));
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const input: SubmitWritingInput = {
      draft_id: "draft-1",
      problem_id: "problem-1",
      question_no: 54,
      answer_text: "answer",
      answer_json: null,
      char_count: 6,
      canonical_question_id: "topik-writing-54-0001",
      canonical_import_id: "701",
      canonical_payload_hash: "payload-hash-701",
    };
    const { result } = renderHook(() => useSubmitWriting(action), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync(input)).rejects.toThrow();
    await expect(result.current.mutateAsync(input)).rejects.toThrow();

    expect(randomUuid).toHaveBeenCalledTimes(1);
    expect(
      action.mock.calls.map(([call]) => call.submission_intent_id),
    ).toEqual([intentId, intentId]);
  });
});
