// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useSubmitWriting,
  useUpsertDraft,
} from "../../../src/lib/writing/mutations";
import type {
  SubmitWritingActionResult,
  SubmitWritingInput,
} from "../../../src/lib/writing/server-actions";
import type {
  ClientSubmissionIntent,
  SubmissionIntentPersistence,
} from "../../../src/lib/writing/client-recovery";
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

function createIntentPersistence() {
  let intent: ClientSubmissionIntent | null = null;
  const order: string[] = [];
  const persistence: SubmissionIntentPersistence = {
    async clear(intentId) {
      order.push("clear");
      if (intent?.intentId === intentId) intent = null;
    },
    async find(fingerprint) {
      order.push("find");
      return intent?.fingerprint === fingerprint ? intent : null;
    },
    async markAmbiguous(intentId) {
      order.push("ambiguous");
      if (intent?.intentId === intentId) {
        intent = { ...intent, state: "ambiguous" };
      }
    },
    async persist(next) {
      order.push("persist");
      intent = next;
    },
  };
  return { getIntent: () => intent, order, persistence };
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
  it.each(["fingerprint", "find", "persist"] as const)(
    "sanitizes a private %s preflight failure before it reaches the learner",
    async (failurePoint) => {
      const stored = createIntentPersistence();
      if (failurePoint === "find") {
        stored.persistence.find = vi.fn(async () => {
          throw new Error("private indexeddb provider detail");
        });
      }
      if (failurePoint === "persist") {
        stored.persistence.persist = vi.fn(async () => {
          throw new Error("private indexeddb quota detail");
        });
      }
      const action = vi.fn();
      const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      });
      const { result } = renderHook(
        () =>
          useSubmitWriting(action, {
            createFingerprint:
              failurePoint === "fingerprint"
                ? async () => {
                    throw new Error("private crypto provider detail");
                  }
                : async () => "fingerprint-safe",
            createIntentId: () => "intent-safe",
            intentPersistence: stored.persistence,
          }),
        { wrapper: createWrapper(queryClient) },
      );

      let error: unknown;
      try {
        await result.current.mutateAsync({
          answer_text: "answer",
          char_count: 6,
          problem_id: "problem-1",
          question_no: 54,
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) {
        throw new Error("Expected the submission preflight to fail.");
      }
      expect(error.message).toBe(
        "제출을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      expect(error.message).not.toContain("private");
      expect(action).not.toHaveBeenCalled();
    },
  );

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
      "제출을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
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

  it("reuses a persisted ambiguous intent after reload without automatic resubmission", async () => {
    const intentId = "11111111-1111-4111-8111-111111111111";
    const stored = createIntentPersistence();
    const createIntentId = vi.fn(() => intentId);
    const action = vi
      .fn()
      .mockRejectedValue(new Error("writing_submission_dispatch_ambiguous"));
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const options = {
      createFingerprint: async () => "fingerprint-1",
      createIntentId,
      intentPersistence: stored.persistence,
      now: () => "2026-07-18T00:00:00.000Z",
    };
    const submitInput: SubmitWritingInput = {
      answer_json: null,
      answer_text: "answer",
      char_count: 6,
      draft_id: "draft-1",
      problem_id: "problem-1",
      question_no: 54,
    };
    const first = renderHook(() => useSubmitWriting(action, options), {
      wrapper: createWrapper(queryClient),
    });
    await expect(
      first.result.current.mutateAsync(submitInput),
    ).rejects.toThrow();
    first.unmount();

    const reloaded = renderHook(() => useSubmitWriting(action, options), {
      wrapper: createWrapper(queryClient),
    });
    expect(action).toHaveBeenCalledTimes(1);
    await expect(
      reloaded.result.current.mutateAsync(submitInput),
    ).rejects.toThrow();

    expect(createIntentId).toHaveBeenCalledTimes(1);
    expect(stored.getIntent()).toMatchObject({ intentId, state: "ambiguous" });
    expect(
      action.mock.calls.map(([call]) => call.submission_intent_id),
    ).toEqual([intentId, intentId]);
  });

  it("persists before dispatch and clears success or confirmed failure", async () => {
    const successStored = createIntentPersistence();
    const successAction = vi.fn(async () => {
      successStored.order.push("action");
      return { questionNo: 54 as const, submissionId: "submission-1" };
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const submitInput: SubmitWritingInput = {
      answer_text: "answer",
      char_count: 6,
      problem_id: "problem-1",
      question_no: 54,
    };
    const success = renderHook(
      () =>
        useSubmitWriting(successAction, {
          createFingerprint: async () => "fingerprint-success",
          createIntentId: () => "intent-success",
          intentPersistence: successStored.persistence,
          now: () => "2026-07-18T00:00:00.000Z",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await success.result.current.mutateAsync(submitInput);
    expect(successStored.order).toEqual(["find", "persist", "action", "clear"]);
    expect(successStored.getIntent()).toBeNull();

    const failedStored = createIntentPersistence();
    const failedAction = vi
      .fn()
      .mockRejectedValue(new Error("writing_submission_dispatch_failed"));
    const failed = renderHook(
      () =>
        useSubmitWriting(failedAction, {
          createFingerprint: async () => "fingerprint-failed",
          createIntentId: () => "intent-failed",
          intentPersistence: failedStored.persistence,
          now: () => "2026-07-18T00:00:00.000Z",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await expect(
      failed.result.current.mutateAsync(submitInput),
    ).rejects.toThrow();
    expect(failedStored.getIntent()).toBeNull();
    expect(failedStored.order.at(-1)).toBe("clear");
  });

  it("creates a new persisted intent when the answer fingerprint changes", async () => {
    const stored = createIntentPersistence();
    const ids = ["intent-1", "intent-2"];
    const createIntentId = vi
      .fn()
      .mockReturnValueOnce(ids[0])
      .mockReturnValueOnce(ids[1]);
    const action = vi
      .fn()
      .mockRejectedValue(new Error("writing_submission_dispatch_ambiguous"));
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const { result } = renderHook(
      () =>
        useSubmitWriting(action, {
          createFingerprint: async (input) => `hash:${input.answer_text}`,
          createIntentId,
          intentPersistence: stored.persistence,
          now: () => "2026-07-18T00:00:00.000Z",
        }),
      { wrapper: createWrapper(queryClient) },
    );
    const base: SubmitWritingInput = {
      answer_text: "first",
      char_count: 5,
      problem_id: "problem-1",
      question_no: 54,
    };

    await expect(result.current.mutateAsync(base)).rejects.toThrow();
    await expect(
      result.current.mutateAsync({ ...base, answer_text: "second" }),
    ).rejects.toThrow();

    expect(createIntentId).toHaveBeenCalledTimes(2);
    expect(
      action.mock.calls.map(([call]) => call.submission_intent_id),
    ).toEqual(ids);
  });

  it("shares one successful dispatch between concurrent equal fingerprints", async () => {
    const stored = createIntentPersistence();
    const createIntentId = vi
      .fn()
      .mockReturnValueOnce("intent-1")
      .mockReturnValueOnce("intent-2");
    let releaseFingerprints!: () => void;
    const fingerprintGate = new Promise<void>((resolve) => {
      releaseFingerprints = resolve;
    });
    const createFingerprint = vi.fn(async () => {
      await fingerprintGate;
      return "same-fingerprint";
    });
    let finish!: () => void;
    const actionGate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const action = vi.fn(async (_input: SubmitWritingInput) => {
      void _input;
      await actionGate;
      return { questionNo: 54 as const, submissionId: "submission-1" };
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const { result } = renderHook(
      () =>
        useSubmitWriting(action, {
          createFingerprint,
          createIntentId,
          intentPersistence: stored.persistence,
          now: () => "2026-07-18T00:00:00.000Z",
        }),
      { wrapper: createWrapper(queryClient) },
    );
    const submitInput: SubmitWritingInput = {
      answer_text: "answer",
      char_count: 6,
      problem_id: "problem-1",
      question_no: 54,
    };

    const first = result.current.mutateAsync(submitInput);
    const second = result.current.mutateAsync(submitInput);
    await waitFor(() => expect(createFingerprint).toHaveBeenCalledTimes(2));
    releaseFingerprints();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    finish();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(createIntentId).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0]?.[0].submission_intent_id).toBe("intent-1");
    expect(secondResult).toBe(firstResult);
  });

  it("shares one failed dispatch between concurrent equal fingerprints", async () => {
    const stored = createIntentPersistence();
    let releaseFingerprints!: () => void;
    const fingerprintGate = new Promise<void>((resolve) => {
      releaseFingerprints = resolve;
    });
    const createFingerprint = vi.fn(async () => {
      await fingerprintGate;
      return "same-fingerprint";
    });
    let fail!: (error: Error) => void;
    const actionGate = new Promise<never>((resolve, reject) => {
      void resolve;
      fail = reject;
    });
    const action = vi.fn(() => actionGate);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const { result } = renderHook(
      () =>
        useSubmitWriting(action, {
          createFingerprint,
          createIntentId: () => "intent-1",
          intentPersistence: stored.persistence,
          now: () => "2026-07-18T00:00:00.000Z",
        }),
      { wrapper: createWrapper(queryClient) },
    );
    const submitInput: SubmitWritingInput = {
      answer_text: "answer",
      char_count: 6,
      problem_id: "problem-1",
      question_no: 54,
    };

    const first = result.current.mutateAsync(submitInput);
    const second = result.current.mutateAsync(submitInput);
    await waitFor(() => expect(createFingerprint).toHaveBeenCalledTimes(2));
    releaseFingerprints();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    fail(new Error("writing_submission_dispatch_ambiguous"));
    const [firstResult, secondResult] = await Promise.allSettled([
      first,
      second,
    ]);

    expect(action).toHaveBeenCalledOnce();
    expect(firstResult.status).toBe("rejected");
    expect(secondResult.status).toBe("rejected");
    if (
      firstResult.status === "rejected" &&
      secondResult.status === "rejected"
    ) {
      expect(secondResult.reason).toBe(firstResult.reason);
    }
    expect(stored.order.filter((event) => event === "ambiguous")).toHaveLength(
      1,
    );
  });

  it("dispatches concurrent different fingerprints independently", async () => {
    const stored = createIntentPersistence();
    const createIntentId = vi
      .fn()
      .mockReturnValueOnce("intent-1")
      .mockReturnValueOnce("intent-2");
    const finishes: Array<() => void> = [];
    const action = vi.fn(
      (input: SubmitWritingInput) =>
        new Promise<SubmitWritingActionResult>((resolve) => {
          finishes.push(() =>
            resolve({
              questionNo: 54,
              submissionId: `submission-${input.answer_text}`,
            }),
          );
        }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const { result } = renderHook(
      () =>
        useSubmitWriting(action, {
          createFingerprint: async (input) => `hash:${input.answer_text}`,
          createIntentId,
          intentPersistence: stored.persistence,
          now: () => "2026-07-18T00:00:00.000Z",
        }),
      { wrapper: createWrapper(queryClient) },
    );
    const base: SubmitWritingInput = {
      answer_text: "first",
      char_count: 5,
      problem_id: "problem-1",
      question_no: 54,
    };

    const first = result.current.mutateAsync(base);
    const second = result.current.mutateAsync({
      ...base,
      answer_text: "second",
      char_count: 6,
    });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    for (const finishAction of finishes) finishAction();
    await Promise.all([first, second]);

    expect(createIntentId).toHaveBeenCalledTimes(2);
    expect(
      action.mock.calls.map(([call]) => call.submission_intent_id),
    ).toEqual(["intent-1", "intent-2"]);
  });
});
