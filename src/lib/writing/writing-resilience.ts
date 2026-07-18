"use client";

import type {
  ClientRecoveryLoadResult,
  ClientRecoveryRecordV1,
  ClientRecoverySaveInput,
  ClientRecoveryScope,
} from "./client-recovery";
import {
  createLatestOnlySaveQueue,
  type LatestOnlySaveQueue,
  type SaveQueueOutcome,
} from "./save-queue";
import type {
  AutosaveStatus,
  WritingDraftInsert,
  WritingDraftRow,
} from "./types";
import { isQuestionNo } from "./types";

export type WritingResilienceSnapshot = {
  draft: WritingDraftInsert;
  draftId: string | null;
};

export type WritingRecoveryState = "checking" | "possible" | "impossible";

export type WritingRecoveryConflict = {
  current: WritingResilienceSnapshot;
  currentDirty: boolean;
  currentSavedAt: string | null;
  prior: ClientRecoveryRecordV1;
  priorSavedAt: string;
};

export type WritingResilienceState = {
  conflict: WritingRecoveryConflict | null;
  hydrated: boolean;
  lastSavedAt: string | null;
  recoveryState: WritingRecoveryState;
  status: AutosaveStatus;
};

export interface WritingRecoveryRepository {
  clearIfUnchanged(
    scope: ClientRecoveryScope,
    expected: ClientRecoveryRecordV1,
  ): Promise<boolean | void>;
  load(scope: ClientRecoveryScope): Promise<ClientRecoveryLoadResult>;
  save(
    input: ClientRecoverySaveInput,
    options?: { expected?: ClientRecoveryRecordV1 | null },
  ): Promise<ClientRecoveryRecordV1>;
}

type VersionedSnapshot = {
  revision: number;
  snapshot: WritingResilienceSnapshot;
};

type ControllerOptions = {
  debounceMs?: number;
  initialLastSavedAt: string | null;
  initialStatus: AutosaveStatus;
  isBlocked?: () => boolean;
  now?: () => string;
  onRecoverySaved?: (record: ClientRecoveryRecordV1) => void;
  onServerSaved?: (
    row: WritingDraftRow,
    snapshot: WritingResilienceSnapshot,
  ) => void;
  onStateChange?: (state: WritingResilienceState) => void;
  repository: WritingRecoveryRepository;
  restorePrior?: (
    record: ClientRecoveryRecordV1,
    current: WritingResilienceSnapshot,
  ) => WritingResilienceSnapshot | undefined;
  saveServer: (draft: WritingDraftInsert) => Promise<WritingDraftRow>;
  scope: ClientRecoveryScope;
};

export class WritingServerSaveBlockedError extends Error {
  readonly code = "latest_server_save_failed";

  constructor(
    readonly recoveryState: Exclude<WritingRecoveryState, "checking">,
  ) {
    super("The latest writing save did not complete.");
    this.name = "WritingServerSaveBlockedError";
  }
}

export class WritingResilienceBlockedError extends Error {
  readonly code = "writing_resilience_blocked";

  constructor() {
    super("Writing is unavailable for this question version.");
    this.name = "WritingResilienceBlockedError";
  }
}

export type WritingResilienceController = {
  chooseRecovery(
    choice: "prior" | "current",
  ): Promise<WritingResilienceSnapshot | undefined>;
  clearAfterSubmitSuccess(): Promise<void>;
  dispose(): void;
  edit(
    snapshot: WritingResilienceSnapshot,
    options?: { scheduleServer?: boolean },
  ): void;
  getLatestSnapshot(): WritingResilienceSnapshot | undefined;
  getState(): WritingResilienceState;
  loadRecovery(current: WritingResilienceSnapshot): Promise<void>;
  manualSave(): Promise<WritingDraftRow>;
  prepareForSubmit(): Promise<WritingDraftRow>;
  retry(): Promise<WritingDraftRow>;
  setServerAutosaveEnabled(enabled: boolean): void;
};

function toRecoveryInput(
  snapshot: WritingResilienceSnapshot,
): ClientRecoverySaveInput {
  const { draft, draftId } = snapshot;
  if (!isQuestionNo(draft.question_no)) {
    throw new WritingResilienceBlockedError();
  }
  return {
    answerJson: draft.answer_json ?? null,
    answerText: draft.answer_text ?? "",
    canonicalQuestionId: draft.canonical_question_id ?? null,
    draftId,
    importId:
      draft.canonical_import_id === null ||
      draft.canonical_import_id === undefined
        ? null
        : String(draft.canonical_import_id),
    payloadHash: draft.canonical_payload_hash ?? null,
    problemId: draft.problem_id,
    questionNo: draft.question_no,
    userId: draft.user_id,
  };
}

function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return null;
}

function sameJson(left: unknown, right: unknown) {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  );
}

function hasSameCanonicalIdentity(
  record: ClientRecoveryRecordV1,
  snapshot: WritingResilienceSnapshot,
) {
  const input = toRecoveryInput(snapshot);
  return (
    record.userId === input.userId &&
    record.problemId === input.problemId &&
    record.questionNo === input.questionNo &&
    record.canonicalQuestionId === input.canonicalQuestionId &&
    record.importId === input.importId &&
    record.payloadHash === input.payloadHash
  );
}

function sameRecoverySnapshot(
  record: ClientRecoveryRecordV1,
  snapshot: WritingResilienceSnapshot,
) {
  const input = toRecoveryInput(snapshot);
  return (
    hasSameCanonicalIdentity(record, snapshot) &&
    record.draftId === input.draftId &&
    record.answerText === input.answerText &&
    sameJson(record.answerJson, input.answerJson)
  );
}

export function createWritingResilienceController({
  debounceMs = 2_000,
  initialLastSavedAt,
  initialStatus,
  isBlocked = () => false,
  now = () => new Date().toISOString(),
  onRecoverySaved,
  onServerSaved,
  onStateChange,
  repository,
  restorePrior,
  saveServer,
  scope,
}: ControllerOptions): WritingResilienceController {
  let autosaveEnabled = true;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let latest: VersionedSnapshot | undefined;
  let latestServerRequestedRevision = 0;
  let lastReportedServerRevision = 0;
  let preparedRecoveryRecord: ClientRecoveryRecordV1 | undefined;
  let recoveryBaseline: ClientRecoveryRecordV1 | null | undefined;
  let recoveryCleanup: { promise: Promise<void>; revision: number } | undefined;
  let revision = 0;
  let serverBaselineLastSavedAt = initialLastSavedAt;
  let state: WritingResilienceState = {
    conflict: null,
    hydrated: false,
    lastSavedAt: initialLastSavedAt,
    recoveryState: "checking",
    status: initialStatus,
  };

  function emit(patch: Partial<WritingResilienceState>) {
    if (disposed) return;
    state = { ...state, ...patch };
    onStateChange?.(state);
  }

  const localQueue: LatestOnlySaveQueue<
    VersionedSnapshot,
    ClientRecoveryRecordV1
  > = createLatestOnlySaveQueue({
    save: async ({ snapshot }) => {
      const expected = recoveryBaseline;
      const saved = await repository.save(
        toRecoveryInput(snapshot),
        expected === undefined ? {} : { expected },
      );
      recoveryBaseline = saved;
      return saved;
    },
  });
  const serverQueue: LatestOnlySaveQueue<VersionedSnapshot, WritingDraftRow> =
    createLatestOnlySaveQueue({
      save: async ({ snapshot }) => {
        const row = await saveServer({
          ...snapshot.draft,
          last_saved_at: serverBaselineLastSavedAt,
        });
        serverBaselineLastSavedAt = row.last_saved_at ?? null;
        return row;
      },
    });

  function blocked() {
    return isBlocked();
  }

  function cancelDebounce() {
    if (debounceTimer === undefined) return;
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }

  function recordLocal(entry: VersionedSnapshot) {
    emit({ recoveryState: "checking" });
    const outcome = localQueue.request(entry);
    void outcome.then((result) => {
      if (disposed || entry.revision !== latest?.revision) return;
      if (result.status === "saved" && result.isLatest) {
        emit({ recoveryState: "possible" });
        onRecoverySaved?.(result.result);
      } else if (result.status === "failed" && result.isLatest) {
        emit({ recoveryState: "impossible" });
      }
    });
    return outcome;
  }

  async function finishServerSuccess(
    entry: VersionedSnapshot,
    row: WritingDraftRow,
  ) {
    if (disposed || entry.revision !== latest?.revision) return;
    if (lastReportedServerRevision < entry.revision) {
      lastReportedServerRevision = entry.revision;
      emit({
        lastSavedAt: row.last_saved_at ?? now(),
        status: "clean",
      });
      onServerSaved?.(row, entry.snapshot);
    }
    if (recoveryCleanup?.revision === entry.revision) {
      await recoveryCleanup.promise;
      return;
    }
    const promise = (async () => {
      try {
        await localQueue.flush();
        if (disposed || entry.revision !== latest?.revision) return;
        const beforeDelete = await repository.load(scope);
        if (
          beforeDelete.status === "missing" ||
          beforeDelete.status === "expired"
        ) {
          recoveryBaseline = null;
        }
        if (
          beforeDelete.status !== "found" ||
          !sameRecoverySnapshot(beforeDelete.record, entry.snapshot)
        ) {
          emit({ recoveryState: "possible" });
          return;
        }
        recoveryBaseline = beforeDelete.record;
        const deleted = await repository.clearIfUnchanged(
          scope,
          beforeDelete.record,
        );
        if (deleted) recoveryBaseline = null;
        if (!disposed && entry.revision === latest?.revision) {
          emit({ recoveryState: deleted ? "impossible" : "possible" });
        }
      } catch {
        if (!disposed && entry.revision === latest?.revision) {
          emit({
            recoveryState:
              localQueue.getState().status === "failed"
                ? "impossible"
                : "possible",
          });
        }
      }
    })();
    recoveryCleanup = { promise, revision: entry.revision };
    try {
      await promise;
    } finally {
      if (recoveryCleanup?.promise === promise) recoveryCleanup = undefined;
    }
  }

  function handleServerOutcome(
    entry: VersionedSnapshot,
    outcome: SaveQueueOutcome<WritingDraftRow>,
  ) {
    if (disposed || entry.revision !== latest?.revision) return;
    if (outcome.status === "saved" && outcome.isLatest) {
      void finishServerSuccess(entry, outcome.result);
    } else if (outcome.status === "failed" && outcome.isLatest) {
      emit({ status: "failed" });
    }
  }

  function requestLatestServer() {
    if (!latest || blocked() || state.conflict) return undefined;
    const entry = latest;
    if (
      latestServerRequestedRevision === entry.revision &&
      serverQueue.getState().status !== "failed"
    ) {
      return undefined;
    }
    latestServerRequestedRevision = entry.revision;
    emit({ status: "syncing" });
    const outcome = serverQueue.request(entry);
    void outcome.then((result) => handleServerOutcome(entry, result));
    return outcome;
  }

  function scheduleLatestServer() {
    cancelDebounce();
    if (!autosaveEnabled || blocked()) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      requestLatestServer();
    }, debounceMs);
  }

  function startLatestWork(scheduleServer: boolean) {
    if (!latest || blocked() || !state.hydrated || state.conflict) return;
    cancelDebounce();
    const entry = latest;
    const localOutcome = recordLocal(entry);
    if (!scheduleServer || !autosaveEnabled) {
      cancelDebounce();
      return;
    }
    void localOutcome.then((result) => {
      if (
        result.status === "saved" &&
        result.isLatest &&
        !disposed &&
        autosaveEnabled &&
        entry.revision === latest?.revision &&
        !state.conflict
      ) {
        scheduleLatestServer();
      }
    });
  }

  function edit(
    snapshot: WritingResilienceSnapshot,
    options: { scheduleServer?: boolean } = {},
  ) {
    if (disposed || blocked() || state.conflict) return;
    preparedRecoveryRecord = undefined;
    revision += 1;
    latest = { revision, snapshot };
    emit({ status: "dirty" });
    if (!state.hydrated) return;
    startLatestWork(options.scheduleServer !== false);
  }

  async function flushLatestServer() {
    if (blocked()) throw new WritingResilienceBlockedError();
    if (state.conflict) throw new WritingResilienceBlockedError();
    if (!latest) throw new WritingServerSaveBlockedError("impossible");
    cancelDebounce();
    while (latest) {
      const entry = latest;
      requestLatestServer();
      try {
        const row = await serverQueue.flush();
        if (entry.revision !== latest.revision) continue;
        await finishServerSuccess(entry, row);
        return row;
      } catch {
        emit({ status: "failed" });
        throw new WritingServerSaveBlockedError(
          state.recoveryState === "possible" ? "possible" : "impossible",
        );
      }
    }
    throw new WritingServerSaveBlockedError("impossible");
  }

  async function manualSave() {
    if (blocked()) throw new WritingResilienceBlockedError();
    if (state.conflict) throw new WritingResilienceBlockedError();
    if (latest) {
      recordLocal(latest);
      try {
        await localQueue.flush();
      } catch {
        emit({ recoveryState: "impossible" });
        throw new WritingServerSaveBlockedError("impossible");
      }
    }
    return flushLatestServer();
  }

  async function prepareForSubmit() {
    if (blocked()) throw new WritingResilienceBlockedError();
    const row = await manualSave();
    if (!latest) throw new WritingServerSaveBlockedError("impossible");
    const entry = latest;
    recordLocal(entry);
    try {
      preparedRecoveryRecord = await localQueue.flush();
    } catch {
      emit({ recoveryState: "impossible" });
      throw new WritingServerSaveBlockedError("impossible");
    }
    emit({ recoveryState: "possible" });
    return row;
  }

  async function loadRecovery(current: WritingResilienceSnapshot) {
    if (blocked()) {
      emit({ hydrated: true, recoveryState: "impossible" });
      return;
    }
    const wasHydrated = state.hydrated;
    let loaded: ClientRecoveryLoadResult;
    try {
      loaded = await repository.load(scope);
    } catch {
      emit({ conflict: null, hydrated: true, recoveryState: "impossible" });
      return;
    }
    if (disposed) return;
    const pendingInitialEdit = !wasHydrated && latest !== undefined;
    const effectiveCurrent = latest?.snapshot ?? current;
    if (loaded.status === "found") {
      if (!hasSameCanonicalIdentity(loaded.record, effectiveCurrent)) {
        emit({ conflict: null, hydrated: true, recoveryState: "impossible" });
        return;
      }
      recoveryBaseline = loaded.record;
      if (!sameRecoverySnapshot(loaded.record, effectiveCurrent)) {
        cancelDebounce();
        emit({
          conflict: {
            current: effectiveCurrent,
            currentDirty:
              latest !== undefined &&
              state.status !== "clean" &&
              state.status !== "superseded",
            currentSavedAt: effectiveCurrent.draft.last_saved_at ?? null,
            prior: loaded.record,
            priorSavedAt: loaded.record.savedAt,
          },
          hydrated: true,
          recoveryState: "possible",
        });
        return;
      }
      emit({ conflict: null, hydrated: true, recoveryState: "possible" });
    } else {
      if (loaded.status === "missing" || loaded.status === "expired") {
        recoveryBaseline = null;
      }
      emit({ conflict: null, hydrated: true, recoveryState: "impossible" });
    }
    if (!latest && !state.conflict) {
      revision += 1;
      latest = { revision, snapshot: current };
    }
    if (pendingInitialEdit && latest && !state.conflict) startLatestWork(true);
  }

  async function chooseRecovery(choice: "prior" | "current") {
    if (blocked()) throw new WritingResilienceBlockedError();
    const conflict = state.conflict;
    if (!conflict) return undefined;
    if (choice === "current") {
      if (conflict.currentDirty) {
        emit({ conflict: null });
        edit(conflict.current);
        return conflict.current;
      }
      revision += 1;
      latest = { revision, snapshot: conflict.current };
      try {
        const deleted = await repository.clearIfUnchanged(
          scope,
          conflict.prior,
        );
        if (disposed || state.conflict !== conflict) return conflict.current;
        if (deleted) recoveryBaseline = null;
        emit({
          conflict: null,
          recoveryState: deleted ? "impossible" : "possible",
          status: "clean",
        });
      } catch {
        if (disposed || state.conflict !== conflict) return conflict.current;
        emit({ conflict: null, recoveryState: "possible", status: "clean" });
      }
      return conflict.current;
    }
    if (
      !restorePrior ||
      !hasSameCanonicalIdentity(conflict.prior, conflict.current)
    ) {
      return undefined;
    }
    const selected = restorePrior(conflict.prior, conflict.current);
    if (!selected) return undefined;
    emit({ conflict: null });
    edit(selected);
    return selected;
  }

  async function clearAfterSubmitSuccess() {
    cancelDebounce();
    const expected = preparedRecoveryRecord;
    preparedRecoveryRecord = undefined;
    try {
      const deleted = expected
        ? await repository.clearIfUnchanged(scope, expected)
        : false;
      if (deleted) recoveryBaseline = null;
      emit({
        conflict: null,
        recoveryState: deleted ? "impossible" : "possible",
        status: "superseded",
      });
    } catch {
      emit({ conflict: null, recoveryState: "possible", status: "superseded" });
    }
  }

  function setServerAutosaveEnabled(enabled: boolean) {
    if (disposed || autosaveEnabled === enabled) return;
    autosaveEnabled = enabled;
    if (!enabled) {
      cancelDebounce();
      return;
    }
    if (
      latest &&
      state.status === "dirty" &&
      state.hydrated &&
      !state.conflict
    ) {
      const expectedRevision = latest.revision;
      void localQueue.awaitIdle().then(() => {
        if (
          !disposed &&
          autosaveEnabled &&
          expectedRevision === latest?.revision &&
          state.status === "dirty" &&
          !state.conflict
        ) {
          scheduleLatestServer();
        }
      });
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelDebounce();
    localQueue.dispose();
    serverQueue.dispose();
  }

  return {
    chooseRecovery,
    clearAfterSubmitSuccess,
    dispose,
    edit,
    getLatestSnapshot: () => latest?.snapshot,
    getState: () => state,
    loadRecovery,
    manualSave,
    prepareForSubmit,
    retry: manualSave,
    setServerAutosaveEnabled,
  };
}
