// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShortAnswerWritingWorkspace } from "@/components/writing/useShortAnswerWritingWorkspace";
import { getCharLimit } from "@/lib/writing/constants";
import type { NormalizedWritingProblem } from "@/lib/writing/problem-normalizer";
import type { WritingResilienceSnapshot } from "@/lib/writing/writing-resilience";
import type { WritingDraftRow } from "@/lib/writing/types";

const hookMocks = vi.hoisted(() => ({
  chooseRecovery: vi.fn(),
  clearAfterSubmitSuccess: vi.fn(),
  edit: vi.fn(),
  getLatestSnapshot: vi.fn(),
  latestSnapshot: null as WritingResilienceSnapshot | null,
  manualSave: vi.fn(),
  prepareForSubmit: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  resilienceOptions: null as Record<string, unknown> | null,
  retry: vi.fn(),
  state: {
    conflict: null,
    hydrated: true,
    lastSavedAt: "2026-08-24T00:00:00.000Z",
    recoveryState: "possible" as const,
    status: "clean" as const,
  },
  submit: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: hookMocks.push,
    refresh: vi.fn(),
    replace: hookMocks.replace,
  }),
}));

vi.mock("@/lib/events/study-events", () => ({
  logStudyEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/writing/mutations", () => ({
  useSubmitWriting: () => ({ isPending: false, mutate: hookMocks.submit }),
  useUpsertDraft: () => ({
    isPending: false,
    mutateAsync: hookMocks.upsert,
  }),
}));

vi.mock("@/lib/writing/use-writing-resilience", () => ({
  useWritingResilience: (options: Record<string, unknown>) => {
    hookMocks.resilienceOptions = options;
    if (!hookMocks.latestSnapshot) {
      hookMocks.latestSnapshot =
        options.initialSnapshot as WritingResilienceSnapshot;
    }
    return {
      chooseRecovery: hookMocks.chooseRecovery,
      clearAfterSubmitSuccess: hookMocks.clearAfterSubmitSuccess,
      edit: hookMocks.edit,
      getLatestSnapshot: hookMocks.getLatestSnapshot,
      intentPersistence: {},
      manualSave: hookMocks.manualSave,
      prepareForSubmit: hookMocks.prepareForSubmit,
      retry: hookMocks.retry,
      setServerAutosaveEnabled: vi.fn(),
      state: hookMocks.state,
    };
  },
}));

type ShortProblem = Extract<NormalizedWritingProblem, { kind: "q51" | "q52" }>;

function shortProblem(questionNo: 51 | 52): ShortProblem {
  const common = {
    answerMode: "per_blank" as const,
    blankedPrompt: "(ㄱ) 그리고 (ㄴ)",
    blanks: [
      {
        answerType: null,
        functionLabel: null,
        key: "ㄱ",
        label: "(ㄱ)",
        role: null,
        targetHint: null,
      },
      {
        answerType: null,
        functionLabel: null,
        key: "ㄴ",
        label: "(ㄴ)",
        role: null,
        targetHint: null,
      },
    ],
    canonicalImportId: "701",
    canonicalQuestionId: `question-${questionNo}`,
    charLimit: getCharLimit(questionNo),
    fallbackWarnings: [],
    id: `problem-${questionNo}`,
    lifecycleReason: null,
    lifecycleStatus: "active" as const,
    payloadHash: `hash-${questionNo}`,
    prompt: "prompt",
    rubric: { conditions: [], criteria: [] },
    submitBlockedReason: null,
    textType: null,
    title: `Question ${questionNo}`,
    validationMessages: [],
  };
  return questionNo === 51
    ? { ...common, kind: "q51", questionNo: 51 }
    : { ...common, kind: "q52", questionNo: 52 };
}

function savedDraft(questionNo: 51 | 52): WritingDraftRow {
  return {
    answer_json: null,
    answer_text: "",
    autosave_status: "clean",
    canonical_import_id: 701,
    canonical_payload_hash: `hash-${questionNo}`,
    canonical_question_id: `question-${questionNo}`,
    char_count: 0,
    created_at: "2026-08-24T00:00:00.000Z",
    id: `saved-draft-${questionNo}`,
    last_saved_at: "2026-08-24T00:00:00.000Z",
    legacy_cutover_snapshot: null,
    problem_id: `problem-${questionNo}`,
    question_no: questionNo,
    question_snapshot: null,
    updated_at: "2026-08-24T00:00:00.000Z",
    user_id: "user-1",
  };
}

function renderShortAnswerHook(questionNo: 51 | 52) {
  return renderHook(() =>
    useShortAnswerWritingWorkspace({
      draft: null,
      onAnswerActivity: vi.fn(),
      onAnswersSelected: vi.fn(),
      problem: shortProblem(questionNo),
      retrySeed: null,
      returnHref: "/leave",
      userId: "user-1",
    }),
  );
}

const invalidAdapterOptionProbe = {
  draft: null,
  onAnswerActivity: vi.fn(),
  onAnswersSelected: vi.fn(),
  problem: shortProblem(51),
  retrySeed: null,
  returnHref: "/leave",
  userId: "user-1",
  // @ts-expect-error The problem kind is the only adapter selection input.
  adapter: undefined,
} satisfies Parameters<typeof useShortAnswerWritingWorkspace>[0];
void invalidAdapterOptionProbe;

beforeEach(() => {
  vi.clearAllMocks();
  hookMocks.latestSnapshot = null;
  hookMocks.resilienceOptions = null;
  hookMocks.edit.mockImplementation((snapshot) => {
    hookMocks.latestSnapshot = snapshot;
  });
  hookMocks.getLatestSnapshot.mockImplementation(
    () => hookMocks.latestSnapshot ?? undefined,
  );
  hookMocks.manualSave.mockResolvedValue(savedDraft(51));
  hookMocks.prepareForSubmit.mockResolvedValue(savedDraft(51));
  hookMocks.retry.mockResolvedValue(savedDraft(51));
});

afterEach(() => cleanup());

const COMPONENTS = [
  "LongFormWriting53Workspace.tsx",
  "EssayWriting54Workspace.tsx",
  "LongFormEditor.tsx",
] as const;

const SHORT_COMPONENTS = [
  "ShortAnswerWriting51Workspace.tsx",
  "ShortAnswerWriting52Workspace.tsx",
] as const;

function readComponent(fileName: (typeof COMPONENTS)[number]) {
  return readFileSync(
    join(process.cwd(), "src", "components", "writing", fileName),
    "utf8",
  );
}

function readWritingSource(fileName: string) {
  return readFileSync(
    join(process.cwd(), "src", "components", "writing", fileName),
    "utf8",
  );
}

describe.each(SHORT_COMPONENTS)(
  "%s short-answer orchestration integration",
  (fileName) => {
    it("uses the common short-answer orchestration boundary", () => {
      const source = readWritingSource(fileName);

      expect(source).toContain("useShortAnswerWritingWorkspace");
      expect(source).not.toContain("useWritingResilience");
      expect(source).not.toContain("const DEBOUNCE_MS = 2000");
    });
  },
);

describe("short-answer orchestration contract", () => {
  it("keeps the two-second autosave and flushes the latest snapshot before submit", () => {
    const source = readWritingSource("useShortAnswerWritingWorkspace.ts");

    expect(source).toContain("const SHORT_ANSWER_AUTOSAVE_MS = 2000");
    expect(source).toContain("debounceMs: SHORT_ANSWER_AUTOSAVE_MS");
    expect(source).toMatch(
      /savedDraft = await resilience\.prepareForSubmit\(\)[\s\S]*?latest = resilience\.getLatestSnapshot\(\)/,
    );
  });

  it("keeps failed save-and-leave navigation pending and preserves explicit conflict choice", () => {
    const source = readWritingSource("useShortAnswerWritingWorkspace.ts");

    expect(source).toContain("if (saved) exitGuard.proceedPendingNavigation()");
    expect(source).toContain("await resilience.chooseRecovery(choice)");
  });
});

describe.each([51, 52] as const)(
  "question %s short-answer hook behavior",
  (questionNo) => {
    it("uses the latest edited answer only after the save finishes", async () => {
      let finishSave: ((row: WritingDraftRow) => void) | undefined;
      hookMocks.prepareForSubmit.mockImplementation(
        () =>
          new Promise<WritingDraftRow>((resolve) => {
            finishSave = resolve;
          }),
      );
      const { result } = renderShortAnswerHook(questionNo);

      act(() => result.current.onChange(`latest-${questionNo}`));
      let prepared: Awaited<
        ReturnType<typeof result.current.prepareSubmission>
      >;
      const preparation = result.current.prepareSubmission().then((value) => {
        prepared = value;
      });

      expect(hookMocks.getLatestSnapshot).not.toHaveBeenCalled();
      await act(async () => {
        finishSave?.(savedDraft(questionNo));
        await preparation;
      });

      expect(prepared!).toEqual(
        expect.objectContaining({
          payload: {
            answerJson: {
              _v: `${questionNo}.v1`,
              blanks: { "(ㄱ)": `latest-${questionNo}`, "(ㄴ)": "" },
            },
            answerText: `(ㄱ): latest-${questionNo}`,
            charCount: `latest-${questionNo}`.length,
          },
          savedDraft: expect.objectContaining({
            id: `saved-draft-${questionNo}`,
          }),
        }),
      );
      expect(
        (
          hookMocks.resilienceOptions
            ?.initialSnapshot as WritingResilienceSnapshot
        ).draft,
      ).toEqual(
        expect.objectContaining({
          answer_json: {
            _v: `${questionNo}.v1`,
            blanks: { "(ㄱ)": "", "(ㄴ)": "" },
          },
          question_no: questionNo,
        }),
      );
    });

    it("blocks submission when the latest draft save fails", async () => {
      hookMocks.prepareForSubmit.mockRejectedValue(new Error("503"));
      const { result } = renderShortAnswerHook(questionNo);

      let prepared: Awaited<
        ReturnType<typeof result.current.prepareSubmission>
      >;
      await act(async () => {
        prepared = await result.current.prepareSubmission();
      });

      const workspaceSource = readWritingSource(
        `ShortAnswerWriting${questionNo}Workspace.tsx`,
      );
      expect(prepared!).toBeUndefined();
      expect(hookMocks.getLatestSnapshot).not.toHaveBeenCalled();
      expect(hookMocks.submit).not.toHaveBeenCalled();
      expect(result.current.modalTrigger).toBe("save_failure");
      expect(workspaceSource).toMatch(
        /const prepared = await prepareSubmission\(\);[\s\S]*?if \(!prepared\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?submit\.mutate\(/,
      );
    });

    it("keeps navigation pending when save-and-leave fails", async () => {
      hookMocks.manualSave.mockRejectedValue(new Error("503"));
      const { result } = renderShortAnswerHook(questionNo);

      act(() => result.current.onChange(`dirty-${questionNo}`));
      act(() => result.current.exitGuard.requestNavigation("/leave"));
      expect(result.current.exitGuard.pendingNavigation).toEqual({
        kind: "href",
        href: "/leave",
        mode: "push",
      });

      act(() => result.current.onRetryWarning());
      await waitFor(() => expect(hookMocks.manualSave).toHaveBeenCalledOnce());

      expect(result.current.exitGuard.pendingNavigation).not.toBeNull();
      expect(hookMocks.push).not.toHaveBeenCalled();
      expect(hookMocks.replace).not.toHaveBeenCalled();
    });

    it("updates hook state with the explicitly selected recovery answer", async () => {
      hookMocks.chooseRecovery.mockResolvedValue({
        draft: {
          ...(
            hookMocks.resilienceOptions
              ?.initialSnapshot as WritingResilienceSnapshot
          )?.draft,
          answer_json: {
            _v: `${questionNo}.v1`,
            blanks: {
              "(ㄱ)": `recovered-${questionNo}`,
              "(ㄴ)": "second answer",
            },
          },
        },
        draftId: `recovered-draft-${questionNo}`,
      });
      const { result } = renderShortAnswerHook(questionNo);

      await act(async () => {
        await result.current.onChooseRecovery("prior");
      });

      expect(hookMocks.chooseRecovery).toHaveBeenCalledWith("prior");
      expect(result.current.blankAnswers).toEqual({
        "(ㄱ)": `recovered-${questionNo}`,
        "(ㄴ)": "second answer",
      });
      expect(result.current.activeBlankValue).toBe(`recovered-${questionNo}`);
    });
  },
);

describe.each(COMPONENTS)("%s writing resilience integration", (fileName) => {
  it("replaces component-owned debounce sequencing with the shared controller", () => {
    const source = readComponent(fileName);

    expect(source).toContain("useWritingResilience({");
    expect(source).not.toContain("debounceRef");
    expect(source).not.toContain("saveSeqRef");
    expect(source).not.toContain("setTimeout(");
  });

  it("uses recovery-backed submission intent and clears only on success", () => {
    const source = readComponent(fileName);

    expect(source).toMatch(
      /useSubmitWriting\(undefined,\s*\{\s*intentPersistence:\s*resilience\.intentPersistence,?\s*\}\)/,
    );
    expect(source).toContain("await resilience.prepareForSubmit()");
    expect(source).toMatch(
      /onSuccess:\s*\(result\)\s*=>\s*\{[\s\S]*?void resilience\.clearAfterSubmitSuccess\(\)/,
    );
    expect(source).not.toMatch(
      /onError:\s*\(e\)\s*=>\s*\{[\s\S]*?clearAfterSubmitSuccess/,
    );
  });

  it("shows actual recovery state and requires an explicit conflict choice", () => {
    const source = readComponent(fileName);

    expect(source).toContain("<WritingRecoveryConflictModal");
    expect(source).toContain("conflict={resilience.state.conflict}");
    expect(source).toContain("recoveryState={resilience.state.recoveryState}");
    expect(source).toContain("await resilience.chooseRecovery(choice)");
  });
});

describe("question-specific immutable snapshots", () => {
  it("keeps all q53 sections in each edit and recovery selection", () => {
    const source = readComponent("LongFormWriting53Workspace.tsx");

    expect(source).toContain("cloneLongFormDraftJson(build53Json(state))");
    expect(source).toContain("combine53Sections(state)");
    expect(source).toContain("resilience.edit(createSnapshot(nextState))");
    expect(source).toContain("setState(readInitial53(selected.draft))");
  });

  it("keeps q54 text and the full checklist in each edit and recovery selection", () => {
    const source = readComponent("EssayWriting54Workspace.tsx");

    expect(source).toContain("cloneLongFormDraftJson(build54Json(state))");
    expect(source).toContain("resilience.edit(createSnapshot(nextState))");
    expect(source).toContain("setState(readInitial54(selected.draft))");
  });

  it.each([
    "LongFormWriting53Workspace.tsx",
    "EssayWriting54Workspace.tsx",
  ] as const)(
    "%s keeps the exit guard dirty until a chosen current draft is actually saved",
    (fileName) => {
      const source = readComponent(fileName);

      expect(source.match(/setLastSavedSnapshot\(/g)).toHaveLength(1);
      expect(source).toMatch(
        /onServerSaved:[\s\S]*?setLastSavedSnapshot\([\s\S]*?\),/,
      );
    },
  );

  it.each(COMPONENTS)(
    "%s keeps a malformed structured recovery conflict open",
    (fileName) => {
      const source = readComponent(fileName);

      expect(source).toContain("return undefined;");
    },
  );

  it("keeps both legacy long-form question shapes immutable", () => {
    const source = readComponent("LongFormEditor.tsx");

    expect(source).toContain("cloneLongFormDraftJson(buildAnswerJson(state))");
    expect(source).toContain(
      "resilience.edit(createEditedSnapshot(nextState))",
    );
    expect(source).toContain("setState53(readInitial53(selected.draft))");
    expect(source).toContain("setState54(readInitial54(selected.draft))");
  });
});
