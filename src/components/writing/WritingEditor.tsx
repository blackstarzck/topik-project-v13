"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Space, Typography } from "antd";
import { useTranslations } from "next-intl";

import { logStudyEvent } from "@/lib/events/study-events";
import type { ClientRecoveryRecordV1 } from "@/lib/writing/client-recovery";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import {
  isShortAnswer,
  type QuestionNo,
  type WritingDraftRow,
} from "@/lib/writing/types";
import { useWritingResilience } from "@/lib/writing/use-writing-resilience";
import type { WritingResilienceSnapshot } from "@/lib/writing/writing-resilience";
import { AutosaveBadge } from "./AutosaveBadge";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import { ConditionsPanel, type ProblemRubric } from "./ConditionsPanel";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SubmissionFailedModal } from "./SubmissionFailedModal";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { WritingRecoveryConflictModal } from "./WritingRecoveryConflictModal";

const { Text } = Typography;

type Props = {
  userId: string;
  problemId: string;
  questionNo: QuestionNo;
  initialDraft: WritingDraftRow | null;
  rubric?: ProblemRubric;
  submitBlockedReason?: string | null;
};

const DEBOUNCE_MS = 2000;

export function WritingEditor({
  userId,
  problemId,
  questionNo,
  initialDraft,
  rubric = null,
  submitBlockedReason = null,
}: Props) {
  const t = useTranslations("writing.editor");
  const [text, setText] = useState(initialDraft?.answer_text ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  const [blurNotice, setBlurNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAnalysis, setSubmittedAnalysis] =
    useState<SubmittedAnalysisState | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [recoveryChoice, setRecoveryChoice] = useState<
    "prior" | "current" | null
  >(null);
  const draftIdRef = useRef<string | null>(initialDraft?.id ?? null);
  const explicitSaveRef = useRef<"manual" | "submit" | null>(null);
  const upsert = useUpsertDraft();

  const initialSnapshot = useMemo<WritingResilienceSnapshot>(
    () => ({
      draft: {
        user_id: userId,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: initialDraft?.answer_text ?? "",
        answer_json: initialDraft?.answer_json ?? null,
        char_count: initialDraft?.char_count ?? 0,
        canonical_question_id: initialDraft?.canonical_question_id ?? null,
        canonical_import_id: initialDraft?.canonical_import_id ?? null,
        canonical_payload_hash: initialDraft?.canonical_payload_hash ?? null,
        question_snapshot: initialDraft?.question_snapshot ?? null,
        autosave_status: initialDraft?.autosave_status ?? "clean",
        last_saved_at: initialDraft?.last_saved_at ?? null,
      },
      draftId: initialDraft?.id ?? null,
    }),
    [initialDraft, problemId, questionNo, userId],
  );
  const saveServer = useCallback(
    (nextDraft: WritingResilienceSnapshot["draft"]) =>
      upsert.mutateAsync(nextDraft),
    [upsert],
  );
  const onServerSaved = useCallback(
    (row: WritingDraftRow, snapshot: WritingResilienceSnapshot) => {
      draftIdRef.current = row.id;
      if (explicitSaveRef.current === null) {
        void logStudyEvent({
          eventType: "draft_autosaved",
          problemId,
          payload: {
            question_no: questionNo,
            char_count:
              snapshot.draft.char_count ??
              (snapshot.draft.answer_text ?? "").length,
          },
        });
      }
    },
    [problemId, questionNo],
  );
  const restorePrior = useCallback(
    (
      record: ClientRecoveryRecordV1,
      current: WritingResilienceSnapshot,
    ): WritingResilienceSnapshot => ({
      draft: {
        ...current.draft,
        answer_text: record.answerText,
        answer_json: record.answerJson,
        char_count: record.answerText.length,
        autosave_status: "dirty",
      },
      draftId: record.draftId ?? current.draftId,
    }),
    [],
  );
  const resilience = useWritingResilience({
    debounceMs: DEBOUNCE_MS,
    initialSnapshot,
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

  const limit = getCharLimit(questionNo);
  const charCount = useMemo(() => text.length, [text]);
  const submittable = isCountSubmittable(charCount, questionNo);
  const inRecommended = isCountInRecommendedRange(charCount, questionNo);
  const minChars = limit.hardMin;

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId,
      payload: { question_no: questionNo },
    });
    // A writing surface records this only once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const hasUnsaved = status === "dirty" || status === "failed";
    if (!hasUnsaved) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const previousStatusRef = useRef(status);
  useEffect(() => {
    if (status === "failed" && previousStatusRef.current !== "failed") {
      setWarningTrigger("save_failure");
    }
    previousStatusRef.current = status;
  }, [status]);

  function buildSnapshot(next: string): WritingResilienceSnapshot {
    return {
      draft: {
        ...initialSnapshot.draft,
        answer_text: next,
        char_count: next.length,
        autosave_status: "dirty",
        last_saved_at: resilience.state.lastSavedAt,
      },
      draftId: draftIdRef.current,
    };
  }

  function onChange(next: string) {
    setText(next);
    setBlurNotice(null);
    resilience.edit(buildSnapshot(next));
  }

  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  async function onManualSave() {
    explicitSaveRef.current = "manual";
    try {
      await resilience.manualSave();
    } catch {
      setWarningTrigger("save_failure");
    } finally {
      explicitSaveRef.current = null;
    }
  }

  function onBlurValidate() {
    if (text.length === 0) return;
    if (charCount < minChars) {
      setBlurNotice(t("blurTooShort", { minChars, charCount }));
    } else if (charCount > limit.hardMax) {
      setBlurNotice(t("blurTooLong", { hardMax: limit.hardMax, charCount }));
    } else {
      setBlurNotice(null);
    }
  }

  async function submitAnswer({
    clearFailure = true,
  }: { clearFailure?: boolean } = {}) {
    if (clearFailure) setSubmitError(null);
    explicitSaveRef.current = "submit";

    let savedDraft: WritingDraftRow;
    let latest: WritingResilienceSnapshot | undefined;
    try {
      savedDraft = await resilience.prepareForSubmit();
      latest = resilience.getLatestSnapshot();
      if (!latest) throw new Error("The latest writing draft is unavailable.");
    } catch {
      setConfirmOpen(false);
      setWarningTrigger("save_failure");
      return;
    } finally {
      explicitSaveRef.current = null;
    }

    const submittedText = latest.draft.answer_text ?? "";
    const submittedCharCount = latest.draft.char_count ?? submittedText.length;
    submit.mutate(
      {
        draft_id: savedDraft.id,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: submittedText,
        char_count: submittedCharCount,
      },
      {
        onSuccess: (result) => {
          void resilience.clearAfterSubmitSuccess();
          setConfirmOpen(false);
          setSubmitError(null);
          void logStudyEvent({
            eventType: "submission_submitted",
            problemId,
            submissionId: result.submissionId,
            payload: {
              question_no: questionNo,
              char_count: submittedCharCount,
            },
          });
          const next = isShortAnswer(result.questionNo)
            ? `/writing/feedback/short/${result.submissionId}`
            : `/writing/feedback/long/${result.submissionId}`;
          setSubmittedAnalysis({
            submissionId: result.submissionId,
            questionNo: result.questionNo,
            answerText: submittedText,
            charCount: submittedCharCount,
            submittedAt: new Date().toISOString(),
            feedbackHref: next,
          });
        },
        onError: (e) => {
          setConfirmOpen(false);
          setSubmitError(e.message);
        },
      },
    );
  }

  async function onChooseRecovery(choice: "prior" | "current") {
    setRecoveryChoice(choice);
    try {
      const selected = await resilience.chooseRecovery(choice);
      if (!selected) return;
      draftIdRef.current = selected.draftId;
      setText(selected.draft.answer_text ?? "");
      setBlurNotice(null);
    } finally {
      setRecoveryChoice(null);
    }
  }

  if (submittedAnalysis) {
    return <SubmittedAnalysisPanel state={submittedAnalysis} />;
  }

  return (
    <Space orientation="vertical" size="middle" className="w-full">
      {questionNo === 52 ? (
        <ConditionsPanel
          questionNo={52}
          rubric={rubric}
          loadFailed={submitBlockedReason === "problem_data_incomplete"}
        />
      ) : null}
      {submitBlockedReason ? (
        <Alert type="warning" showIcon title={t("submitBlockedProblemData")} />
      ) : null}

      <Space wrap>
        <AutosaveBadge status={status} lastSavedAt={lastSavedAt} />
        <Text type={inRecommended ? "success" : "secondary"}>
          {t("charCount", { charCount, hardMax: limit.hardMax })}{" "}
          {limit.recommendedMin !== limit.hardMin ||
          limit.recommendedMax !== limit.hardMax
            ? t("recommendedRange", {
                min: limit.recommendedMin,
                max: limit.recommendedMax,
              })
            : t("minOnly", { min: limit.hardMin })}
          {inRecommended ? " ✓" : ""}
        </Text>
        <Button size="small" type="link" onClick={onToggleAutosave}>
          {autosaveEnabled ? t("autosaveOff") : t("autosaveOn")}
        </Button>
      </Space>
      {!autosaveEnabled ? (
        <Text type="warning" className="text-xs">
          {t("autosaveDisabledNotice")}
        </Text>
      ) : null}
      <Input.TextArea
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlurValidate}
        autoSize={{ minRows: isShortAnswer(questionNo) ? 3 : 12 }}
        maxLength={limit.hardMax}
        placeholder={
          isShortAnswer(questionNo)
            ? t("placeholderShort")
            : t("placeholderLong")
        }
        disabled={
          submit.isPending ||
          !resilience.state.hydrated ||
          Boolean(resilience.state.conflict)
        }
      />
      {blurNotice ? (
        <Text type="danger" className="text-xs">
          {blurNotice}
        </Text>
      ) : null}

      <Space>
        <Button
          onClick={() => void onManualSave()}
          loading={status === "syncing"}
          disabled={
            submit.isPending ||
            text.length === 0 ||
            !resilience.state.hydrated ||
            Boolean(resilience.state.conflict)
          }
        >
          {t("saveDraft")}
        </Button>
        <Button
          type="primary"
          onClick={() => {
            setSubmitError(null);
            setConfirmOpen(true);
          }}
          disabled={
            !submittable ||
            submit.isPending ||
            Boolean(submitBlockedReason) ||
            !resilience.state.hydrated ||
            Boolean(resilience.state.conflict)
          }
        >
          {t("submit")}
        </Button>
      </Space>

      <SubmissionConfirmModal
        open={confirmOpen}
        charCount={charCount}
        minChars={minChars}
        questionNo={questionNo}
        lastSavedAt={lastSavedAt}
        loading={submit.isPending || status === "syncing"}
        onConfirm={() => void submitAnswer()}
        onCancel={() => {
          setSubmitError(null);
          setConfirmOpen(false);
        }}
      />
      <SubmissionFailedModal
        open={Boolean(submitError)}
        submitError={submitError}
        loading={submit.isPending}
        onRetry={() => void submitAnswer({ clearFailure: false })}
        onClose={() => setSubmitError(null)}
      />
      <AutosaveWarningModal
        trigger={warningTrigger}
        lastSavedAt={lastSavedAt}
        retrying={status === "syncing"}
        recoveryState={resilience.state.recoveryState}
        onKeep={() => setWarningTrigger(null)}
        onRetry={() => {
          setWarningTrigger(null);
          void resilience.retry().catch(() => {
            setWarningTrigger("save_failure");
          });
        }}
        onProceed={() => {
          if (warningTrigger === "disable_attempt") {
            setAutosaveEnabled(false);
          }
          setWarningTrigger(null);
        }}
      />
      <WritingRecoveryConflictModal
        choosing={recoveryChoice}
        conflict={resilience.state.conflict}
        onChoose={onChooseRecovery}
      />
    </Space>
  );
}
