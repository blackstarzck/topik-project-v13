"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildClientRecoveryKey,
  ClientRecoveryRepository,
  createIndexedDbClientRecoveryStorage,
  createRecoverySubmissionIntentPersistence,
  type ClientRecoveryRecordV1,
} from "./client-recovery";
import {
  createRecoveryChannelCoordinator,
  type RecoveryConflictMetadata,
} from "./recovery-channel";
import {
  createWritingResilienceController,
  WritingResilienceBlockedError,
  type WritingResilienceController,
  type WritingResilienceSnapshot,
  type WritingResilienceState,
} from "./writing-resilience";
import type { WritingDraftRow } from "./types";
import { isQuestionNo } from "./types";

type RecoveryCoordinator = ReturnType<typeof createRecoveryChannelCoordinator>;

export type UseWritingResilienceOptions = {
  debounceMs?: number;
  initialSnapshot: WritingResilienceSnapshot;
  isBlocked?: () => boolean;
  onServerSaved?: (
    row: WritingDraftRow,
    snapshot: WritingResilienceSnapshot,
  ) => void;
  repository?: ClientRecoveryRepository;
  restorePrior: (
    record: ClientRecoveryRecordV1,
    current: WritingResilienceSnapshot,
  ) => WritingResilienceSnapshot;
  saveServer: (
    draft: WritingResilienceSnapshot["draft"],
  ) => Promise<WritingDraftRow>;
  serverAutosaveEnabled?: boolean;
  /** Test seam; production uses the browser BroadcastChannel/storage fallback. */
  createRecoveryCoordinator?: (options: {
    key: string;
    onConflict: (metadata: RecoveryConflictMetadata) => void;
  }) => RecoveryCoordinator;
};

export type UseWritingResilienceResult = {
  chooseRecovery: WritingResilienceController["chooseRecovery"];
  clearAfterSubmitSuccess: WritingResilienceController["clearAfterSubmitSuccess"];
  edit: WritingResilienceController["edit"];
  getLatestSnapshot: WritingResilienceController["getLatestSnapshot"];
  intentPersistence: ReturnType<
    typeof createRecoverySubmissionIntentPersistence
  >;
  manualSave: WritingResilienceController["manualSave"];
  prepareForSubmit: WritingResilienceController["prepareForSubmit"];
  retry: WritingResilienceController["retry"];
  setServerAutosaveEnabled: WritingResilienceController["setServerAutosaveEnabled"];
  state: WritingResilienceState;
};

function initialState(
  snapshot: WritingResilienceSnapshot,
): WritingResilienceState {
  return {
    conflict: null,
    hydrated: false,
    lastSavedAt: snapshot.draft.last_saved_at ?? null,
    recoveryState: "checking",
    status: snapshot.draft.autosave_status ?? "clean",
  };
}

export function useWritingResilience({
  createRecoveryCoordinator = createRecoveryChannelCoordinator,
  debounceMs,
  initialSnapshot,
  isBlocked,
  onServerSaved,
  repository: providedRepository,
  restorePrior,
  saveServer,
  serverAutosaveEnabled = true,
}: UseWritingResilienceOptions): UseWritingResilienceResult {
  const nativeRepository = useMemo(
    () => new ClientRecoveryRepository(createIndexedDbClientRecoveryStorage()),
    [],
  );
  const repository = providedRepository ?? nativeRepository;
  const scope = useMemo(() => {
    const questionNo = initialSnapshot.draft.question_no;
    if (!isQuestionNo(questionNo)) throw new WritingResilienceBlockedError();
    return {
      problemId: initialSnapshot.draft.problem_id,
      questionNo,
      userId: initialSnapshot.draft.user_id,
    };
  }, [
    initialSnapshot.draft.problem_id,
    initialSnapshot.draft.question_no,
    initialSnapshot.draft.user_id,
  ]);
  const recoveryKey = useMemo(() => buildClientRecoveryKey(scope), [scope]);
  const intentPersistence = useMemo(
    () => createRecoverySubmissionIntentPersistence(repository, scope),
    [repository, scope],
  );
  const [state, setState] = useState(() => initialState(initialSnapshot));
  const controllerRef = useRef<WritingResilienceController | undefined>(
    undefined,
  );
  const currentSnapshotRef = useRef(initialSnapshot);
  const isBlockedRef = useRef(isBlocked);
  const onServerSavedRef = useRef(onServerSaved);
  const restorePriorRef = useRef(restorePrior);
  const saveServerRef = useRef(saveServer);

  useEffect(() => {
    isBlockedRef.current = isBlocked;
    onServerSavedRef.current = onServerSaved;
    restorePriorRef.current = restorePrior;
    saveServerRef.current = saveServer;
  }, [isBlocked, onServerSaved, restorePrior, saveServer]);

  useEffect(() => {
    let active = true;
    const coordinatorHolder: { current?: RecoveryCoordinator } = {};
    const controller = createWritingResilienceController({
      ...(debounceMs === undefined ? {} : { debounceMs }),
      initialLastSavedAt:
        currentSnapshotRef.current.draft.last_saved_at ?? null,
      initialStatus:
        currentSnapshotRef.current.draft.autosave_status ?? "clean",
      isBlocked: () => isBlockedRef.current?.() ?? false,
      onRecoverySaved: (record) =>
        coordinatorHolder.current?.publish(record.savedAt),
      onServerSaved: (row, snapshot) => {
        currentSnapshotRef.current = snapshot;
        onServerSavedRef.current?.(row, snapshot);
      },
      onStateChange: (nextState) => {
        if (active) setState(nextState);
      },
      repository,
      restorePrior: (record, current) =>
        restorePriorRef.current(record, current),
      saveServer: (draft) => saveServerRef.current(draft),
      scope,
    });
    controllerRef.current = controller;
    const coordinator = createRecoveryCoordinator({
      key: recoveryKey,
      onConflict: () => {
        const current =
          controller.getLatestSnapshot() ?? currentSnapshotRef.current;
        void controller.loadRecovery(current);
      },
    });
    coordinatorHolder.current = coordinator;
    void repository
      .sweepExpired()
      .catch(() => undefined)
      .then(() => controller.loadRecovery(currentSnapshotRef.current));

    return () => {
      active = false;
      coordinator?.dispose();
      controller.dispose();
      if (controllerRef.current === controller)
        controllerRef.current = undefined;
    };
  }, [createRecoveryCoordinator, debounceMs, recoveryKey, repository, scope]);

  useEffect(() => {
    controllerRef.current?.setServerAutosaveEnabled(serverAutosaveEnabled);
  }, [serverAutosaveEnabled]);

  const requireController = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) throw new WritingResilienceBlockedError();
    return controller;
  }, []);

  const edit = useCallback<WritingResilienceController["edit"]>(
    (snapshot, options) => {
      currentSnapshotRef.current = snapshot;
      requireController().edit(snapshot, options);
    },
    [requireController],
  );

  return {
    chooseRecovery: useCallback(
      (choice) => requireController().chooseRecovery(choice),
      [requireController],
    ),
    clearAfterSubmitSuccess: useCallback(
      () => requireController().clearAfterSubmitSuccess(),
      [requireController],
    ),
    edit,
    getLatestSnapshot: useCallback(
      () =>
        controllerRef.current?.getLatestSnapshot() ??
        currentSnapshotRef.current,
      [],
    ),
    intentPersistence,
    manualSave: useCallback(
      () => requireController().manualSave(),
      [requireController],
    ),
    prepareForSubmit: useCallback(
      () => requireController().prepareForSubmit(),
      [requireController],
    ),
    retry: useCallback(() => requireController().retry(), [requireController]),
    setServerAutosaveEnabled: useCallback(
      (enabled) => requireController().setServerAutosaveEnabled(enabled),
      [requireController],
    ),
    state,
  };
}
