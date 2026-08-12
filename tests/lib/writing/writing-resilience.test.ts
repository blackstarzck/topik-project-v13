import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WritingServerSaveBlockedError,
  createWritingResilienceController,
  type WritingRecoveryRepository,
  type WritingResilienceSnapshot,
} from "../../../src/lib/writing/writing-resilience";
import type {
  ClientRecoveryRecordV1,
  ClientRecoverySaveInput,
} from "../../../src/lib/writing/client-recovery";
import { buildClientRecoveryKey } from "../../../src/lib/writing/client-recovery";
import type { WritingDraftRow } from "../../../src/lib/writing/types";

const NOW = "2026-07-18T00:00:00.000Z";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, reject, resolve };
}

function snapshot(
  answerText: string,
  overrides: Partial<WritingResilienceSnapshot["draft"]> = {},
): WritingResilienceSnapshot {
  return {
    draft: {
      answer_json: { _v: "54.v1", text: answerText },
      answer_text: answerText,
      autosave_status: "clean",
      canonical_import_id: 701,
      canonical_payload_hash: "payload-hash-701",
      canonical_question_id: "topik-writing-54-0001",
      char_count: answerText.length,
      last_saved_at: NOW,
      problem_id: "problem-1",
      question_no: 54,
      user_id: "user-1",
      ...overrides,
    },
    draftId: "draft-1",
  };
}

function recoveryRecord(
  input: ClientRecoverySaveInput,
  overrides: Partial<ClientRecoveryRecordV1> = {},
): ClientRecoveryRecordV1 {
  return {
    ...input,
    expiresAt: "2026-07-19T00:00:00.000Z",
    firstStoredAt: NOW,
    key: buildClientRecoveryKey(input),
    retention: "default",
    savedAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

function serverRow(answerText: string): WritingDraftRow {
  return {
    answer_json: { _v: "54.v1", text: answerText },
    answer_text: answerText,
    autosave_status: "clean",
    canonical_import_id: 701,
    canonical_payload_hash: "payload-hash-701",
    canonical_question_id: "topik-writing-54-0001",
    char_count: answerText.length,
    created_at: NOW,
    id: "draft-1",
    last_saved_at: NOW,
    legacy_cutover_snapshot: null,
    problem_id: "problem-1",
    question_no: 54,
    question_snapshot: null,
    updated_at: NOW,
    user_id: "user-1",
  };
}

function repositoryDouble(overrides: Partial<WritingRecoveryRepository> = {}) {
  let current: ClientRecoveryRecordV1 | undefined;
  const repository: WritingRecoveryRepository = {
    clearIfUnchanged: vi.fn(async (_scope, expected) => {
      if (current && JSON.stringify(current) !== JSON.stringify(expected)) {
        return false;
      }
      current = undefined;
      return true;
    }),
    load: vi.fn(async () =>
      current
        ? { record: current, status: "found" as const }
        : { status: "missing" as const },
    ),
    save: vi.fn(async (input) => {
      current = recoveryRecord(input);
      return current;
    }),
    ...overrides,
  };
  return repository;
}

function createController(
  repository: WritingRecoveryRepository,
  saveServer: (
    snapshot: WritingResilienceSnapshot["draft"],
  ) => Promise<WritingDraftRow>,
  options: {
    isBlocked?: () => boolean;
    onServerSaved?: (
      row: WritingDraftRow,
      snapshot: WritingResilienceSnapshot,
    ) => void;
    restorePrior?: (
      record: ClientRecoveryRecordV1,
      current: WritingResilienceSnapshot,
    ) => WritingResilienceSnapshot | undefined;
  } = {},
) {
  return createWritingResilienceController({
    debounceMs: 1_000,
    initialLastSavedAt: NOW,
    initialStatus: "clean",
    now: () => NOW,
    repository,
    ...options,
    saveServer,
    scope: {
      canonicalQuestionId: "topik-writing-54-0001",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("writing resilience controller", () => {
  it("serializes local recovery writes and retains only the latest pending edit", async () => {
    const firstWrite = deferred<ClientRecoveryRecordV1>();
    const repository = repositoryDouble({
      save: vi
        .fn()
        .mockImplementationOnce(() => firstWrite.promise)
        .mockImplementation(async (input: ClientRecoverySaveInput) =>
          recoveryRecord(input),
        ),
    });
    const controller = createController(repository, vi.fn());
    await controller.loadRecovery(snapshot("baseline"));

    controller.edit(snapshot("first"), { scheduleServer: false });
    controller.edit(snapshot("second"), { scheduleServer: false });
    controller.edit(snapshot("latest"), { scheduleServer: false });

    expect(repository.save).toHaveBeenCalledTimes(1);
    firstWrite.resolve(
      recoveryRecord(
        (repository.save as ReturnType<typeof vi.fn>).mock.calls[0]![0],
      ),
    );
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(2));
    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ answerText: "latest" }),
      { expected: expect.objectContaining({ answerText: "first" }) },
    );
    await vi.waitFor(() =>
      expect(controller.getState().recoveryState).toBe("possible"),
    );

    controller.dispose();
  });

  it("does not let an old server completion clear a newer local edit", async () => {
    vi.useFakeTimers();
    const firstSave = deferred<WritingDraftRow>();
    const secondSave = deferred<WritingDraftRow>();
    const saveServer = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const repository = repositoryDouble();
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));

    controller.edit(snapshot("first"));
    await vi.advanceTimersByTimeAsync(1_000);
    controller.edit(snapshot("latest"));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saveServer).toHaveBeenCalledTimes(1);

    firstSave.resolve(serverRow("first"));
    await vi.waitFor(() => expect(saveServer).toHaveBeenCalledTimes(2));
    expect(repository.clearIfUnchanged).not.toHaveBeenCalled();

    secondSave.resolve(serverRow("latest"));
    await vi.waitFor(() =>
      expect(repository.clearIfUnchanged).toHaveBeenCalledOnce(),
    );
    expect(controller.getState()).toMatchObject({
      lastSavedAt: NOW,
      status: "clean",
    });

    controller.dispose();
  });

  it("carries the committed server revision into a queued newer save", async () => {
    vi.useFakeTimers();
    const firstSave = deferred<WritingDraftRow>();
    const saveServer = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({
        ...serverRow("latest"),
        last_saved_at: "2026-07-18T00:02:00.000Z",
      });
    const controller = createController(repositoryDouble(), saveServer);
    await controller.loadRecovery(snapshot("baseline"));

    controller.edit(snapshot("first"));
    await vi.advanceTimersByTimeAsync(1_000);
    controller.edit(snapshot("latest"));
    await vi.advanceTimersByTimeAsync(1_000);

    firstSave.resolve({
      ...serverRow("first"),
      last_saved_at: "2026-07-18T00:01:00.000Z",
    });
    await vi.waitFor(() => expect(saveServer).toHaveBeenCalledTimes(2));

    expect(saveServer.mock.calls[0]?.[0].last_saved_at).toBe(NOW);
    expect(saveServer.mock.calls[1]?.[0].last_saved_at).toBe(
      "2026-07-18T00:01:00.000Z",
    );

    controller.dispose();
  });

  it("cancels debounce and flushes the latest snapshot on manual save", async () => {
    vi.useFakeTimers();
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const repository = repositoryDouble();
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("latest"));

    await controller.manualSave();
    expect(saveServer).toHaveBeenCalledOnce();
    expect(saveServer).toHaveBeenCalledWith(
      expect.objectContaining({ answer_text: "latest" }),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saveServer).toHaveBeenCalledOnce();

    controller.dispose();
  });

  it("does not autosave to the server after the local recovery CAS loses", async () => {
    vi.useFakeTimers();
    const repository = repositoryDouble({
      save: vi.fn(async () => Promise.reject(new Error("record_changed"))),
    });
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));

    controller.edit(snapshot("losing tab"));
    await vi.waitFor(() =>
      expect(controller.getState().recoveryState).toBe("impossible"),
    );
    await vi.advanceTimersByTimeAsync(1_000);

    expect(saveServer).not.toHaveBeenCalled();
    controller.dispose();
  });

  it.each(["manualSave", "prepareForSubmit"] as const)(
    "does not let %s bypass a failed local recovery CAS",
    async (operation) => {
      const repository = repositoryDouble({
        save: vi.fn(async () => Promise.reject(new Error("record_changed"))),
      });
      const saveServer = vi.fn(async (draft) =>
        serverRow(draft.answer_text ?? ""),
      );
      const controller = createController(repository, saveServer);
      await controller.loadRecovery(snapshot("baseline"));
      controller.edit(snapshot("losing tab"), { scheduleServer: false });

      await expect(controller[operation]()).rejects.toMatchObject({
        code: "latest_server_save_failed",
        recoveryState: "impossible",
      });
      expect(saveServer).not.toHaveBeenCalled();
      controller.dispose();
    },
  );

  it("does not let a tab replace a recovery copy changed after its explicit conflict baseline", async () => {
    vi.useFakeTimers();
    const first = recoveryRecord({
      answerJson: { _v: "54.v1", text: "first tab version one" },
      answerText: "first tab version one",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-1",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const newer = {
      ...first,
      answerJson: { _v: "54.v1", text: "first tab version two" },
      answerText: "first tab version two",
      savedAt: "2026-07-18T00:00:01.000Z",
    } as ClientRecoveryRecordV1;
    let stored = first;
    const loadGate =
      deferred<Awaited<ReturnType<WritingRecoveryRepository["load"]>>>();
    const repository: WritingRecoveryRepository = {
      clearIfUnchanged: vi.fn(async () => false),
      load: vi.fn(() => loadGate.promise),
      save: vi.fn(async (input, options) => {
        if (JSON.stringify(options?.expected) !== JSON.stringify(stored)) {
          throw new Error("record_changed");
        }
        stored = recoveryRecord(input);
        return stored;
      }),
    };
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const controller = createController(repository, saveServer);
    const load = controller.loadRecovery(snapshot("server baseline"));
    controller.edit(snapshot("second tab current"));
    loadGate.resolve({ record: first, status: "found" });
    await load;
    expect(controller.getState().conflict?.currentDirty).toBe(true);

    stored = newer;
    await controller.chooseRecovery("current");
    await vi.waitFor(() =>
      expect(controller.getState().recoveryState).toBe("impossible"),
    );
    await vi.advanceTimersByTimeAsync(1_000);

    expect(stored).toBe(newer);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ answerText: "second tab current" }),
      { expected: first },
    );
    expect(saveServer).not.toHaveBeenCalled();
    controller.dispose();
  });

  it.each([
    ["possible" as const, false],
    ["impossible" as const, true],
  ])(
    "blocks submit with actual %s recovery state when the latest server save fails",
    async (expectedRecoveryState, localFails) => {
      const repository = repositoryDouble(
        localFails
          ? { save: vi.fn(async () => Promise.reject(new Error("private"))) }
          : {},
      );
      const controller = createController(repository, async () => {
        throw new Error("private server detail");
      });
      await controller.loadRecovery(snapshot("baseline"));
      controller.edit(snapshot("latest"), { scheduleServer: false });

      const error = await controller
        .prepareForSubmit()
        .catch((reason) => reason);

      expect(error).toBeInstanceOf(WritingServerSaveBlockedError);
      expect(error).toMatchObject({
        code: "latest_server_save_failed",
        recoveryState: expectedRecoveryState,
      });
      expect(String(error)).not.toContain("private server detail");

      controller.dispose();
    },
  );

  it("keeps a recovery record for intent persistence immediately before submit", async () => {
    const repository = repositoryDouble();
    const controller = createController(repository, async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("latest"), { scheduleServer: false });

    await controller.prepareForSubmit();

    expect(repository.clearIfUnchanged).toHaveBeenCalledOnce();
    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ answerText: "latest" }),
      { expected: null },
    );
    expect(controller.getState().recoveryState).toBe("possible");

    controller.dispose();
  });

  it("loads only the exact scope and waits for an explicit prior/current choice", async () => {
    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", text: "prior" },
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const controller = createController(repository, vi.fn(), {
      restorePrior: (record, baseline) => ({
        draft: {
          ...baseline.draft,
          answer_json: record.answerJson,
          answer_text: record.answerText,
          char_count: 5,
        },
        draftId: record.draftId,
      }),
    });
    const current = snapshot("current");

    await controller.loadRecovery(current);

    expect(repository.load).toHaveBeenCalledWith({
      canonicalQuestionId: "topik-writing-54-0001",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    expect(controller.getState().conflict).toMatchObject({
      currentSavedAt: NOW,
      priorSavedAt: NOW,
    });
    expect(controller.getLatestSnapshot()).toBeUndefined();

    const selected = await controller.chooseRecovery("prior");
    expect(selected?.draft.answer_text).toBe("prior");
    expect(controller.getLatestSnapshot()?.draft.answer_text).toBe("prior");

    controller.dispose();
  });

  it("does not let manual save overwrite a recovery conflict before selection", async () => {
    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", text: "prior" },
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const loadGate =
      deferred<Awaited<ReturnType<WritingRecoveryRepository["load"]>>>();
    const repository = repositoryDouble({
      load: vi.fn(() => loadGate.promise),
    });
    const controller = createController(repository, vi.fn());
    const load = controller.loadRecovery(snapshot("server current"));
    controller.edit(snapshot("current tab edit"));
    loadGate.resolve({ record: prior, status: "found" });
    await load;
    expect(controller.getState().conflict?.currentDirty).toBe(true);

    await expect(controller.manualSave()).rejects.toMatchObject({
      code: "writing_resilience_blocked",
    });
    expect(repository.save).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("persists an edit made while initial hydration is still in flight", async () => {
    const loadGate =
      deferred<Awaited<ReturnType<WritingRecoveryRepository["load"]>>>();
    const repository = repositoryDouble({
      load: vi.fn(() => loadGate.promise),
    });
    const controller = createController(repository, vi.fn());
    const hydration = controller.loadRecovery(snapshot("current"));

    controller.edit(snapshot("typed-too-early"));
    expect(repository.save).not.toHaveBeenCalled();

    loadGate.resolve({ status: "missing" });
    await hydration;
    expect(controller.getState()).toMatchObject({ hydrated: true });
    await vi.waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ answerText: "typed-too-early" }),
        { expected: null },
      ),
    );
    controller.dispose();
  });

  it("does not republish a matching cross-tab recovery notification", async () => {
    const repository = repositoryDouble();
    const controller = createController(repository, vi.fn());
    const current = snapshot("baseline");
    await controller.loadRecovery(current);
    vi.mocked(repository.load).mockResolvedValue({
      record: recoveryRecord({
        answerJson: current.draft.answer_json ?? null,
        answerText: current.draft.answer_text ?? "",
        canonicalQuestionId: current.draft.canonical_question_id ?? null,
        draftId: current.draftId,
        importId: String(current.draft.canonical_import_id),
        payloadHash: current.draft.canonical_payload_hash ?? null,
        problemId: current.draft.problem_id,
        questionNo: 54,
        userId: current.draft.user_id,
      }),
      status: "found",
    });

    await controller.loadRecovery(current);

    expect(repository.save).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("cancels a scheduled server save when a cross-tab conflict appears", async () => {
    vi.useFakeTimers();
    const repository = repositoryDouble();
    const saveServer = vi.fn(async () => serverRow("local"));
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("local"));
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    vi.mocked(repository.load).mockResolvedValue({
      record: recoveryRecord({
        answerJson: { _v: "54.v1", text: "other-tab" },
        answerText: "other-tab",
        canonicalQuestionId: "topik-writing-54-0001",
        draftId: "draft-other-tab",
        importId: "701",
        payloadHash: "payload-hash-701",
        problemId: "problem-1",
        questionNo: 54,
        userId: "user-1",
      }),
      status: "found",
    });

    await controller.loadRecovery(snapshot("local"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(controller.getState().conflict).not.toBeNull();
    expect(saveServer).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("rechecks the exact current recovery record before clearing after server save", async () => {
    const repository = repositoryDouble();
    const controller = createController(repository, async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("latest"), { scheduleServer: false });
    await vi.waitFor(() =>
      expect(controller.getState().recoveryState).toBe("possible"),
    );
    vi.mocked(repository.load).mockResolvedValue({
      record: recoveryRecord(
        {
          answerJson: { _v: "54.v1", text: "other-tab" },
          answerText: "other-tab",
          canonicalQuestionId: "topik-writing-54-0001",
          draftId: "draft-other-tab",
          importId: "701",
          payloadHash: "payload-hash-701",
          problemId: "problem-1",
          questionNo: 54,
          userId: "user-1",
        },
        { savedAt: "2026-07-18T00:01:00.000Z" },
      ),
      status: "found",
    });

    await controller.manualSave();

    expect(repository.clearIfUnchanged).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      recoveryState: "possible",
      status: "clean",
    });
    controller.dispose();
  });

  it("treats current recovery choice as the clean server baseline", async () => {
    const current = snapshot("current");
    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", text: "prior" },
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const controller = createController(repository, vi.fn());
    await controller.loadRecovery(current);

    const selected = await controller.chooseRecovery("current");

    expect(selected).toBe(current);
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.clearIfUnchanged).toHaveBeenCalledWith(
      expect.anything(),
      prior,
    );
    expect(controller.getState()).toMatchObject({
      conflict: null,
      recoveryState: "impossible",
      status: "clean",
    });
    controller.dispose();
  });

  it("does not clear a newer cross-tab conflict while an older choice is pending", async () => {
    const current = snapshot("current");
    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", text: "prior" },
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const newer = recoveryRecord(
      {
        answerJson: { _v: "54.v1", text: "newer-other-tab" },
        answerText: "newer-other-tab",
        canonicalQuestionId: "topik-writing-54-0001",
        draftId: "draft-newer",
        importId: "701",
        payloadHash: "payload-hash-701",
        problemId: "problem-1",
        questionNo: 54,
        userId: "user-1",
      },
      { savedAt: "2026-07-18T00:01:00.000Z" },
    );
    const clearGate = deferred<boolean>();
    const repository = repositoryDouble({
      clearIfUnchanged: vi.fn(() => clearGate.promise),
      load: vi
        .fn()
        .mockResolvedValueOnce({ record: prior, status: "found" as const })
        .mockResolvedValueOnce({ record: newer, status: "found" as const }),
    });
    const controller = createController(repository, vi.fn());
    await controller.loadRecovery(current);

    const choice = controller.chooseRecovery("current");
    await vi.waitFor(() =>
      expect(repository.clearIfUnchanged).toHaveBeenCalledOnce(),
    );
    await controller.loadRecovery(current);
    expect(controller.getState().conflict?.prior).toBe(newer);

    clearGate.resolve(false);
    await choice;

    expect(controller.getState().conflict?.prior).toBe(newer);
    controller.dispose();
  });

  it("keeps a dirty current-tab choice recoverable and resumes server autosave", async () => {
    vi.useFakeTimers();
    const repository = repositoryDouble();
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));
    const current = snapshot("unsaved-current");
    controller.edit(current);
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalled());

    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", text: "other-tab" },
      answerText: "other-tab",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-other-tab",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    vi.mocked(repository.load).mockResolvedValue({
      record: prior,
      status: "found",
    });
    await controller.loadRecovery(current);
    expect(controller.getState().conflict?.currentDirty).toBe(true);

    vi.mocked(repository.save).mockClear();
    const selected = await controller.chooseRecovery("current");
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() =>
      expect(saveServer).toHaveBeenCalledWith(current.draft),
    );

    expect(selected).toBe(current);
    expect(controller.getState().status).toBe("clean");
    controller.dispose();
  });

  it("delegates prior hydration to the question-specific snapshot builder", async () => {
    const current = snapshot("current");
    const prior = recoveryRecord({
      answerJson: { _v: "51.v1", blanks: ["가", "나"] },
      answerText: "가\n나",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const restored = snapshot("question-specific", {
      answer_json: prior.answerJson,
      char_count: 2,
    });
    const restorePrior = vi.fn(() => restored);
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const controller = createController(repository, vi.fn(), { restorePrior });
    await controller.loadRecovery(current);

    const selected = await controller.chooseRecovery("prior");

    expect(restorePrior).toHaveBeenCalledWith(prior, current);
    expect(selected).toBe(restored);
    expect(controller.getState().status).toBe("dirty");
    controller.dispose();
  });

  it("keeps a conflict open when structured recovery cannot be restored safely", async () => {
    const current = snapshot("current");
    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", checklist: "malformed", text: "prior" },
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const controller = createController(repository, vi.fn(), {
      restorePrior: () => undefined as never,
    });
    await controller.loadRecovery(current);

    const selected = await controller.chooseRecovery("prior");

    expect(selected).toBeUndefined();
    expect(controller.getState().conflict?.prior).toBe(prior);
    expect(repository.save).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("resumes server autosave after the prior recovery copy is selected", async () => {
    vi.useFakeTimers();
    const current = snapshot("current");
    const prior = recoveryRecord({
      answerJson: { _v: "54.v1", text: "prior" },
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-prior",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const restored = snapshot("prior", { answer_json: prior.answerJson });
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const controller = createController(repository, saveServer, {
      restorePrior: () => restored,
    });
    await controller.loadRecovery(current);

    await controller.chooseRecovery("prior");
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() =>
      expect(saveServer).toHaveBeenCalledWith(restored.draft),
    );

    expect(controller.getState().status).toBe("clean");
    controller.dispose();
  });

  it("quarantines recovery records whose canonical identity differs", async () => {
    const prior = recoveryRecord({
      answerJson: null,
      answerText: "prior",
      canonicalQuestionId: "topik-writing-54-other",
      draftId: "draft-prior",
      importId: "999",
      payloadHash: "other-hash",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const controller = createController(repository, vi.fn());

    await controller.loadRecovery(snapshot("current"));

    expect(controller.getState().conflict).toBeNull();
    expect(controller.getLatestSnapshot()).toBeUndefined();
    expect(repository.clearIfUnchanged).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("uses canonical JSON equality when deciding whether recovery conflicts", async () => {
    const prior = recoveryRecord({
      answerJson: { b: 2, a: 1 },
      answerText: "same",
      canonicalQuestionId: "topik-writing-54-0001",
      draftId: "draft-1",
      importId: "701",
      payloadHash: "payload-hash-701",
      problemId: "problem-1",
      questionNo: 54,
      userId: "user-1",
    });
    const repository = repositoryDouble({
      load: vi.fn(async () => ({ record: prior, status: "found" as const })),
    });
    const controller = createController(repository, vi.fn());

    await controller.loadRecovery(
      snapshot("same", { answer_json: { a: 1, b: 2 } }),
    );

    expect(controller.getState().conflict).toBeNull();
    controller.dispose();
  });

  it("does not misreport a successful server save when exact cleanup fails", async () => {
    const repository = repositoryDouble({
      clearIfUnchanged: vi.fn(async () => {
        throw new Error("private storage detail");
      }),
    });
    const saved = serverRow("latest");
    const onServerSaved = vi.fn();
    const controller = createController(repository, async () => saved, {
      onServerSaved,
    });
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("latest"), { scheduleServer: false });

    await expect(controller.manualSave()).resolves.toBe(saved);
    expect(controller.getState().status).toBe("clean");
    expect(onServerSaved).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it("absorbs recovery load failures without exposing the raw reason", async () => {
    const repository = repositoryDouble({
      load: vi.fn(async () => {
        throw new Error("private database detail");
      }),
    });
    const controller = createController(repository, vi.fn());

    await expect(
      controller.loadRecovery(snapshot("current")),
    ).resolves.toBeUndefined();
    expect(controller.getState()).toMatchObject({
      conflict: null,
      hydrated: true,
      recoveryState: "impossible",
    });
    controller.dispose();
  });

  it("cancels server autosave while off and schedules the current dirty snapshot when re-enabled", async () => {
    vi.useFakeTimers();
    const saveServer = vi.fn(async (draft) =>
      serverRow(draft.answer_text ?? ""),
    );
    const repository = repositoryDouble();
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("dirty"));

    controller.setServerAutosaveEnabled(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saveServer).not.toHaveBeenCalled();

    controller.setServerAutosaveEnabled(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saveServer).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it("blocks recovery, save, and submit while the question version is stale", async () => {
    const repository = repositoryDouble();
    const saveServer = vi.fn(async () => serverRow("stale"));
    const controller = createController(repository, saveServer, {
      isBlocked: () => true,
    });

    await controller.loadRecovery(snapshot("stale"));
    controller.edit(snapshot("stale-edit"));
    const error = await controller.prepareForSubmit().catch((reason) => reason);

    expect(repository.load).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(saveServer).not.toHaveBeenCalled();
    expect(error).toMatchObject({ code: "writing_resilience_blocked" });
    controller.dispose();
  });

  it("uses one immutable snapshot through server save and completion callbacks", async () => {
    const latest = snapshot("immutable");
    const saveServer = vi.fn(async () => serverRow("immutable"));
    const onServerSaved = vi.fn();
    const repository = repositoryDouble();
    const controller = createController(repository, saveServer, {
      onServerSaved,
    });
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(latest, { scheduleServer: false });

    await controller.manualSave();

    expect(saveServer).toHaveBeenCalledWith(latest.draft);
    expect(onServerSaved).toHaveBeenCalledWith(expect.anything(), latest);
    controller.dispose();
  });

  it("disposes without flushing or deleting pending work", async () => {
    vi.useFakeTimers();
    const saveServer = vi.fn();
    const repository = repositoryDouble();
    const controller = createController(repository, saveServer);
    await controller.loadRecovery(snapshot("baseline"));
    controller.edit(snapshot("pending"));

    controller.dispose();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(saveServer).not.toHaveBeenCalled();
    expect(repository.clearIfUnchanged).not.toHaveBeenCalled();
  });
});
