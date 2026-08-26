"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { logStudyEvent } from "@/lib/events/study-events";
import type { ClientRecoveryRecordV1 } from "@/lib/writing/client-recovery";
import { isWritingDraftVersionStale } from "@/lib/writing/draft-version";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import type { NormalizedWritingProblem } from "@/lib/writing/problem-normalizer";
import { useWritingResilience } from "@/lib/writing/use-writing-resilience";
import type { WritingResilienceSnapshot } from "@/lib/writing/writing-resilience";
import type { WritingDraftRow, WritingRetrySeed } from "@/lib/writing/types";
import type { WarningTrigger } from "./AutosaveWarningModal";
import {
  createShortAnswerPayload,
  readInitialShortAnswerAnswers,
  readShortAnswerSnapshotAnswers,
  shortAnswerWriting51Adapter,
  shortAnswerWriting52Adapter,
  type ShortAnswerAnswers,
} from "./shortAnswerWritingAdapters";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

type ShortAnswerProblem = Extract<
  NormalizedWritingProblem,
  { kind: "q51" | "q52" }
>;

type Options = {
  draft: WritingDraftRow | null;
  onAnswerActivity: () => void;
  onAnswersSelected: () => void;
  problem: ShortAnswerProblem;
  retrySeed: WritingRetrySeed | null;
  returnHref: string;
  userId: string;
};

const SHORT_ANSWER_AUTOSAVE_MS = 2000;

export function useShortAnswerWritingWorkspace({
  draft,
  onAnswerActivity,
  onAnswersSelected,
  problem,
  retrySeed,
  returnHref,
  userId,
}: Options) {
  const adapter =
    problem.kind === "q51"
      ? shortAnswerWriting51Adapter
      : shortAnswerWriting52Adapter;
  const answerSource = retrySeed ?? draft;
  const initialAnswers = useMemo(
    () => readInitialShortAnswerAnswers(adapter, problem.blanks, answerSource),
    [adapter, answerSource, problem.blanks],
  );
  const canonicalQuestionId = problem.canonicalQuestionId ?? null;
  const canonicalImportId = problem.canonicalImportId ?? null;
  const canonicalPayloadHash = problem.payloadHash ?? null;
  const staleDraftVersion = isWritingDraftVersionStale(draft, {
    questionId: canonicalQuestionId,
    importId: canonicalImportId,
    payloadHash: canonicalPayloadHash,
  });
  const [blankAnswers, setBlankAnswers] =
    useState<ShortAnswerAnswers>(initialAnswers);
  const [activeBlankIndex, setActiveBlankIndex] = useState(0);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  const [recoveryChoice, setRecoveryChoice] = useState<
    "prior" | "current" | null
  >(null);
  const draftIdRef = useRef<string | null>(draft?.id ?? null);
  const explicitSaveRef = useRef<"manual" | "submit" | null>(null);
  const upsert = useUpsertDraft();

  const answerText = useMemo(
    () => adapter.buildAnswerText(blankAnswers, problem.blanks),
    [adapter, blankAnswers, problem.blanks],
  );
  const charCount = useMemo(
    () => adapter.countAnswerChars(blankAnswers),
    [adapter, blankAnswers],
  );
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(blankAnswers),
    [blankAnswers],
  );
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    () => currentAnswerSnapshot,
  );
  const initialPayload = useMemo(
    () => createShortAnswerPayload(adapter, initialAnswers, problem.blanks),
    [adapter, initialAnswers, problem.blanks],
  );
  const initialSnapshot = useMemo<WritingResilienceSnapshot>(
    () => ({
      draft: {
        user_id: userId,
        problem_id: problem.id,
        question_no: adapter.questionNo,
        answer_text: initialPayload.answerText,
        answer_json: initialPayload.answerJson,
        char_count: initialPayload.charCount,
        autosave_status: draft?.autosave_status ?? "clean",
        last_saved_at: draft?.last_saved_at ?? null,
        canonical_question_id: canonicalQuestionId,
        canonical_import_id:
          canonicalImportId === null ? null : Number(canonicalImportId),
        canonical_payload_hash: canonicalPayloadHash,
        question_snapshot: draft?.question_snapshot ?? null,
      },
      draftId: draft?.id ?? null,
    }),
    [
      adapter.questionNo,
      canonicalImportId,
      canonicalPayloadHash,
      canonicalQuestionId,
      draft,
      initialPayload,
      problem.id,
      userId,
    ],
  );
  const saveServer = useCallback(
    (nextDraft: WritingResilienceSnapshot["draft"]) =>
      upsert.mutateAsync(nextDraft),
    [upsert],
  );
  const onServerSaved = useCallback(
    (row: WritingDraftRow, snapshot: WritingResilienceSnapshot) => {
      draftIdRef.current = row.id;
      const savedAnswers = readShortAnswerSnapshotAnswers(
        adapter,
        snapshot.draft.answer_json,
      );
      if (savedAnswers) {
        setLastSavedSnapshot(serializeWritingAnswerSnapshot(savedAnswers));
      }
      if (explicitSaveRef.current === null) {
        void logStudyEvent({
          eventType: "draft_autosaved",
          problemId: problem.id,
          payload: {
            question_no: adapter.questionNo,
            char_count:
              snapshot.draft.char_count ??
              adapter.countAnswerChars(savedAnswers ?? {}),
          },
        });
      }
    },
    [adapter, problem.id],
  );
  const restorePrior = useCallback(
    (
      record: ClientRecoveryRecordV1,
      current: WritingResilienceSnapshot,
    ): WritingResilienceSnapshot => {
      const restoredAnswers = readInitialShortAnswerAnswers(
        adapter,
        problem.blanks,
        {
          answer_json: record.answerJson,
          answer_text: record.answerText,
        },
      );
      const restoredPayload = createShortAnswerPayload(
        adapter,
        restoredAnswers,
        problem.blanks,
      );
      return {
        draft: {
          ...current.draft,
          answer_text: restoredPayload.answerText,
          answer_json: restoredPayload.answerJson,
          char_count: restoredPayload.charCount,
          autosave_status: "dirty",
        },
        draftId: record.draftId ?? current.draftId,
      };
    },
    [adapter, problem.blanks],
  );
  const resilience = useWritingResilience({
    debounceMs: SHORT_ANSWER_AUTOSAVE_MS,
    initialSnapshot,
    isBlocked: () => staleDraftVersion,
    onServerSaved,
    restorePrior,
    saveServer,
    serverAutosaveEnabled: autosaveEnabled,
  });
  const submit = useSubmitWriting(undefined, {
    intentPersistence: resilience.intentPersistence,
  });
  const status = resilience.state.status;
  const lastSavedAt = resilience.state.lastSavedAt;
  const hasUnsavedAnswerChange = currentAnswerSnapshot !== lastSavedSnapshot;
  const exitGuard = useUnsavedChangesGuard({
    when: hasUnsavedAnswerChange,
    fallbackHref: returnHref,
  });
  const modalTrigger: WarningTrigger | null = exitGuard.pendingNavigation
    ? "exit_with_dirty"
    : warningTrigger;
  const activeBlank = problem.blanks[activeBlankIndex] ?? problem.blanks[0];
  const activeBlankValue = activeBlank
    ? (blankAnswers[activeBlank.label] ?? "")
    : "";

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId: problem.id,
      payload: { question_no: adapter.questionNo },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previousStatusRef = useRef(status);
  useEffect(() => {
    if (status === "failed" && previousStatusRef.current !== "failed") {
      setWarningTrigger("save_failure");
    }
    previousStatusRef.current = status;
  }, [status]);

  function buildSnapshot(
    nextAnswers: ShortAnswerAnswers,
  ): WritingResilienceSnapshot {
    const nextPayload = createShortAnswerPayload(
      adapter,
      nextAnswers,
      problem.blanks,
    );
    return {
      draft: {
        ...initialSnapshot.draft,
        user_id: userId,
        problem_id: problem.id,
        question_no: adapter.questionNo,
        answer_text: nextPayload.answerText,
        answer_json: nextPayload.answerJson,
        char_count: nextPayload.charCount,
        autosave_status: "dirty",
        last_saved_at: resilience.state.lastSavedAt,
        canonical_question_id: canonicalQuestionId,
        canonical_import_id:
          canonicalImportId === null ? null : Number(canonicalImportId),
        canonical_payload_hash: canonicalPayloadHash,
      },
      draftId: draftIdRef.current,
    };
  }

  function onChange(next: string) {
    if (!activeBlank) return;
    onAnswerActivity();
    const nextAnswers = { ...blankAnswers, [activeBlank.label]: next };
    setBlankAnswers(nextAnswers);
    onAnswersSelected();
    resilience.edit(buildSnapshot(nextAnswers));
  }

  async function onManualSave() {
    explicitSaveRef.current = "manual";
    try {
      await resilience.manualSave();
      return true;
    } catch {
      setWarningTrigger("save_failure");
      return false;
    } finally {
      explicitSaveRef.current = null;
    }
  }

  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  async function prepareSubmission() {
    explicitSaveRef.current = "submit";
    let savedDraft: WritingDraftRow;
    let latest: WritingResilienceSnapshot | undefined;
    try {
      savedDraft = await resilience.prepareForSubmit();
      latest = resilience.getLatestSnapshot();
      const answers = latest
        ? readShortAnswerSnapshotAnswers(adapter, latest.draft.answer_json)
        : undefined;
      if (!latest || !answers) {
        throw new Error(
          `The latest question ${adapter.questionNo} draft is unavailable.`,
        );
      }
      return {
        payload: createShortAnswerPayload(adapter, answers, problem.blanks),
        savedDraft,
      };
    } catch {
      setWarningTrigger("save_failure");
      return undefined;
    } finally {
      explicitSaveRef.current = null;
    }
  }

  async function onChooseRecovery(choice: "prior" | "current") {
    setRecoveryChoice(choice);
    try {
      const selected = await resilience.chooseRecovery(choice);
      if (!selected) return;
      const selectedAnswers = readShortAnswerSnapshotAnswers(
        adapter,
        selected.draft.answer_json,
      );
      if (!selectedAnswers) return;
      draftIdRef.current = selected.draftId;
      setBlankAnswers(
        Object.fromEntries(
          problem.blanks.map((blank) => [
            blank.label,
            selectedAnswers[blank.label] ?? "",
          ]),
        ),
      );
      onAnswersSelected();
    } finally {
      setRecoveryChoice(null);
    }
  }

  function onKeepWarning() {
    if (exitGuard.pendingNavigation) {
      exitGuard.cancelPendingNavigation();
      return;
    }
    setWarningTrigger(null);
  }

  function onRetryWarning() {
    if (exitGuard.pendingNavigation) {
      void onManualSave().then((saved) => {
        if (saved) exitGuard.proceedPendingNavigation();
      });
      return;
    }
    setWarningTrigger(null);
    void resilience.retry().catch(() => {
      setWarningTrigger("save_failure");
    });
  }

  function onProceedWarning() {
    if (exitGuard.pendingNavigation) {
      exitGuard.proceedPendingNavigation();
      return;
    }
    if (warningTrigger === "disable_attempt") {
      setAutosaveEnabled(false);
    }
    setWarningTrigger(null);
  }

  return {
    activeBlank,
    activeBlankIndex,
    activeBlankValue,
    answerText,
    autosaveEnabled,
    blankAnswers,
    canonicalImportId,
    canonicalPayloadHash,
    canonicalQuestionId,
    charCount,
    exitGuard,
    lastSavedAt,
    modalTrigger,
    onChange,
    onChooseRecovery,
    onKeepWarning,
    onManualSave,
    onProceedWarning,
    onRetryWarning,
    onToggleAutosave,
    prepareSubmission,
    recoveryChoice,
    resilience,
    setActiveBlankIndex,
    staleDraftVersion,
    status,
    submit,
  };
}
