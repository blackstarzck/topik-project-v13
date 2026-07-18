"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Input, Progress, Segmented, Typography } from "antd";
import { Sparkles } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import { logStudyEvent } from "@/lib/events/study-events";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useWritingTimeMetrics } from "@/hooks/useWritingTimeMetrics";
import { recordWritingSubmissionMetrics } from "@/lib/writing/metrics";
import { isWritingDraftVersionStale } from "@/lib/writing/draft-version";
import { useWritingResilience } from "@/lib/writing/use-writing-resilience";
import type { WritingResilienceSnapshot } from "@/lib/writing/writing-resilience";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import type { NormalizedWritingProblem } from "@/lib/writing/problem-normalizer";
import {
  emptyChecklist,
  isLongFormDraftJson,
  type AutosaveStatus,
  type ChecklistItemStatus,
  type EssayChecklistKey,
  type LongFormDraftJson,
  type WritingDraftRow,
  type WritingRetrySeed,
} from "@/lib/writing/types";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import { ConditionsPanel } from "./ConditionsPanel";
import { EssayStructureGuide } from "./EssayStructureGuide";
import { ManuscriptPreview } from "./ManuscriptPreview";
import { QuestionPrompt } from "./QuestionPrompt";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SubmissionFailedModal } from "./SubmissionFailedModal";
import { StaleDraftVersionAlert } from "./StaleDraftVersionAlert";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { WritingGuideAccordion } from "./WritingGuideAccordion";
import { WritingExamShell } from "./WritingExamShell";
import { WritingRecoveryConflictModal } from "./WritingRecoveryConflictModal";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

const { Text } = Typography;

type Q54Problem = Extract<NormalizedWritingProblem, { kind: "q54" }>;

type Props = {
  userId: string;
  problem: Q54Problem;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
  returnHref: string;
};

type Question54State = {
  text: string;
  checklist: Record<EssayChecklistKey, ChecklistItemStatus>;
};

type ComposerMode = "write" | "manuscript";
type LongFormAnswerSource = {
  answer_json?: unknown;
  answer_text?: string | null;
};

const DEBOUNCE_MS = 2000;

function readInitial54(draft: LongFormAnswerSource | null): Question54State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "54.v1"
  ) {
    return {
      text: draft.answer_json.text,
      checklist: { ...draft.answer_json.checklist },
    };
  }
  return { text: draft?.answer_text ?? "", checklist: emptyChecklist() };
}

function build54Json(state: Question54State): LongFormDraftJson {
  return {
    _v: "54.v1",
    text: state.text,
    checklist: state.checklist,
  };
}

function cloneLongFormDraftJson(value: LongFormDraftJson): LongFormDraftJson {
  if (value._v === "53.v1") {
    return { _v: "53.v1", sections: { ...value.sections } };
  }
  return {
    _v: "54.v1",
    text: value.text,
    checklist: { ...value.checklist },
  };
}

function create54Snapshot({
  autosaveStatus = "clean",
  canonicalImportId,
  canonicalPayloadHash,
  canonicalQuestionId,
  draftId,
  lastSavedAt,
  problemId,
  state,
  userId,
}: {
  autosaveStatus?: AutosaveStatus;
  canonicalImportId: string | null;
  canonicalPayloadHash: string | null;
  canonicalQuestionId: string | null;
  draftId: string | null;
  lastSavedAt: string | null;
  problemId: string;
  state: Question54State;
  userId: string;
}): WritingResilienceSnapshot {
  return {
    draft: {
      user_id: userId,
      problem_id: problemId,
      question_no: 54,
      answer_text: state.text,
      answer_json: cloneLongFormDraftJson(build54Json(state)),
      char_count: state.text.length,
      autosave_status: autosaveStatus,
      last_saved_at: lastSavedAt,
      canonical_question_id: canonicalQuestionId,
      canonical_import_id: canonicalImportId ? Number(canonicalImportId) : null,
      canonical_payload_hash: canonicalPayloadHash,
    },
    draftId,
  };
}

export function EssayWriting54Workspace({
  userId,
  problem,
  draft,
  retrySeed = null,
  parentSubmissionId = null,
  returnHref,
}: Props) {
  const tPage = useTranslations("writing.q54");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const answerSource = retrySeed ?? draft;
  const canonicalQuestionId = problem.canonicalQuestionId ?? null;
  const canonicalImportId = problem.canonicalImportId ?? null;
  const canonicalPayloadHash = problem.payloadHash ?? null;
  const staleDraftVersion = isWritingDraftVersionStale(draft, {
    questionId: canonicalQuestionId,
    importId: canonicalImportId,
    payloadHash: canonicalPayloadHash,
  });
  const initialState = useMemo(
    () => readInitial54(answerSource),
    [answerSource],
  );
  const [state, setState] = useState<Question54State>(() => initialState);
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const initialSnapshot = useMemo(
    () =>
      create54Snapshot({
        autosaveStatus: draft?.autosave_status ?? "clean",
        canonicalImportId,
        canonicalPayloadHash,
        canonicalQuestionId,
        draftId: draft?.id ?? null,
        lastSavedAt: draft?.last_saved_at ?? null,
        problemId: problem.id,
        state: initialState,
        userId,
      }),
    [
      canonicalImportId,
      canonicalPayloadHash,
      canonicalQuestionId,
      draft?.autosave_status,
      draft?.id,
      draft?.last_saved_at,
      initialState,
      problem.id,
      userId,
    ],
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  const [failureWarningDismissed, setFailureWarningDismissed] = useState(false);
  const [blurNotice, setBlurNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAnalysis, setSubmittedAnalysis] =
    useState<SubmittedAnalysisState | null>(null);
  const [preparingSubmit, setPreparingSubmit] = useState(false);
  const [choosingRecovery, setChoosingRecovery] = useState<
    "prior" | "current" | null
  >(null);
  const { elapsedSeconds, markInputActivity, getTimeMetricsSnapshot } =
    useWritingTimeMetrics();
  const [composerMode, setComposerMode] = useState<ComposerMode>("write");
  const serverSaveKindRef = useRef<"auto" | "manual">("auto");
  const upsert = useUpsertDraft();

  const limit = getCharLimit(54);
  const charCount = state.text.length;
  const submittable = isCountSubmittable(charCount, 54);
  const inRecommended = isCountInRecommendedRange(charCount, 54);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(build54Json(state)),
    [state],
  );
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    () => currentAnswerSnapshot,
  );
  const resilience = useWritingResilience({
    debounceMs: DEBOUNCE_MS,
    initialSnapshot,
    isBlocked: () => staleDraftVersion,
    onServerSaved: (row, snapshot) => {
      setDraftId(row.id);
      setLastSavedSnapshot(
        serializeWritingAnswerSnapshot(snapshot.draft.answer_json),
      );
      if (serverSaveKindRef.current === "auto") {
        void logStudyEvent({
          eventType: "draft_autosaved",
          problemId: problem.id,
          payload: {
            question_no: 54,
            char_count:
              snapshot.draft.char_count ??
              (snapshot.draft.answer_text ?? "").length,
          },
        });
      }
      serverSaveKindRef.current = "auto";
    },
    restorePrior: (record, current) => {
      if (
        !isLongFormDraftJson(record.answerJson) ||
        record.answerJson._v !== "54.v1"
      ) {
        return current;
      }
      const restoredState = readInitial54({
        answer_json: record.answerJson,
        answer_text: record.answerText,
      });
      return {
        draft: {
          ...current.draft,
          answer_text: restoredState.text,
          answer_json: cloneLongFormDraftJson(build54Json(restoredState)),
          char_count: restoredState.text.length,
        },
        draftId: record.draftId,
      };
    },
    saveServer: (nextDraft) => upsert.mutateAsync(nextDraft),
  });
  const submit = useSubmitWriting(undefined, {
    intentPersistence: resilience.intentPersistence,
  });
  const status = resilience.state.status;
  const lastSavedAt = resilience.state.lastSavedAt;
  const submissionPending = submit.isPending || preparingSubmit;
  const locked =
    Boolean(problem.submitBlockedReason) ||
    staleDraftVersion ||
    Boolean(resilience.state.conflict);
  const hasUnsavedAnswerChange = currentAnswerSnapshot !== lastSavedSnapshot;
  const exitGuard = useUnsavedChangesGuard({
    when: hasUnsavedAnswerChange,
    fallbackHref: returnHref,
  });
  const modalTrigger: WarningTrigger | null = exitGuard.pendingNavigation
    ? "exit_with_dirty"
    : (warningTrigger ??
      (resilience.state.hydrated &&
      status === "failed" &&
      !failureWarningDismissed
        ? "save_failure"
        : null));
  const guideLoadFailed =
    problem.submitBlockedReason === "problem_data_incomplete";

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId: problem.id,
      payload: { question_no: 54 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createSnapshot(nextState: Question54State) {
    return create54Snapshot({
      autosaveStatus: "dirty",
      canonicalImportId,
      canonicalPayloadHash,
      canonicalQuestionId,
      draftId,
      lastSavedAt: resilience.state.lastSavedAt,
      problemId: problem.id,
      state: nextState,
      userId,
    });
  }

  function validateLength() {
    if (charCount === 0) {
      setBlurNotice(null);
      return;
    }
    if (charCount < limit.hardMin) {
      setBlurNotice(
        tEditor("blurTooShort", {
          minChars: limit.hardMin,
          charCount,
        }),
      );
    } else if (charCount > limit.hardMax) {
      setBlurNotice(
        tEditor("blurTooLong", {
          hardMax: limit.hardMax,
          charCount,
        }),
      );
    } else {
      setBlurNotice(null);
    }
  }

  function onTextChange(next: string) {
    markInputActivity();
    const nextState = { ...state, text: next };
    setState(nextState);
    setBlurNotice(null);
    setFailureWarningDismissed(false);
    resilience.edit(createSnapshot(nextState));
  }

  async function saveLatest(kind: "manual" | "retry") {
    if (staleDraftVersion) return false;
    resilience.edit(createSnapshot(state), { scheduleServer: false });
    serverSaveKindRef.current = kind === "manual" ? "manual" : "auto";
    try {
      if (kind === "manual") await resilience.manualSave();
      else await resilience.retry();
      setWarningTrigger(null);
      return true;
    } catch {
      setWarningTrigger("save_failure");
      return false;
    } finally {
      serverSaveKindRef.current = "auto";
    }
  }

  function onManualSave() {
    void saveLatest("manual");
  }

  function onOpenSubmitConfirm() {
    validateLength();
    if (!submittable || locked) return;
    setSubmitError(null);
    setConfirmOpen(true);
  }

  async function submitAnswer({
    clearFailure = true,
  }: { clearFailure?: boolean } = {}) {
    if (clearFailure) setSubmitError(null);
    setPreparingSubmit(true);
    resilience.edit(createSnapshot(state), { scheduleServer: false });
    serverSaveKindRef.current = "manual";
    try {
      const savedRow = await resilience.prepareForSubmit();
      const prepared = resilience.getLatestSnapshot();
      if (!prepared) throw new Error("writing_resilience_blocked");
      setDraftId(savedRow.id);
      const answerText = prepared.draft.answer_text ?? "";
      const preparedCharCount = answerText.length;
      submit.mutate(
        {
          draft_id: savedRow.id,
          problem_id: problem.id,
          question_no: 54,
          parent_submission_id: parentSubmissionId,
          answer_text: answerText,
          answer_json: JSON.parse(JSON.stringify(prepared.draft.answer_json)),
          char_count: preparedCharCount,
          canonical_question_id: canonicalQuestionId,
          canonical_import_id: canonicalImportId,
          canonical_payload_hash: canonicalPayloadHash,
        },
        {
          onSuccess: (result) => {
            void resilience.clearAfterSubmitSuccess();
            setConfirmOpen(false);
            setSubmitError(null);
            void logStudyEvent({
              eventType: "submission_submitted",
              problemId: problem.id,
              submissionId: result.submissionId,
              payload: { question_no: 54, char_count: preparedCharCount },
            });
            void recordWritingSubmissionMetrics({
              submissionId: result.submissionId,
              problemId: problem.id,
              questionNo: 54,
              ...getTimeMetricsSnapshot(),
            });
            setSubmittedAnalysis({
              submissionId: result.submissionId,
              questionNo: result.questionNo,
              answerText,
              charCount: preparedCharCount,
              submittedAt: new Date().toISOString(),
              feedbackHref: `/writing/feedback/long/${result.submissionId}`,
            });
          },
          onError: (e) => {
            setConfirmOpen(false);
            setSubmitError(e.message);
          },
        },
      );
    } catch {
      setConfirmOpen(false);
      setSubmitError(null);
      setWarningTrigger("save_failure");
    } finally {
      serverSaveKindRef.current = "auto";
      setPreparingSubmit(false);
    }
  }

  function onConfirmSubmit() {
    void submitAnswer();
  }

  function onRetrySubmitFailure() {
    void submitAnswer({ clearFailure: false });
  }

  async function onChooseRecovery(choice: "prior" | "current") {
    setChoosingRecovery(choice);
    try {
      const selected = await resilience.chooseRecovery(choice);
      if (!selected) return;
      setState(readInitial54(selected.draft));
      setDraftId(selected.draftId);
      setBlurNotice(null);
    } finally {
      setChoosingRecovery(null);
    }
  }

  if (submittedAnalysis) {
    return <SubmittedAnalysisPanel state={submittedAnalysis} />;
  }

  const charCountUI = (
    <Text type={inRecommended ? "success" : "secondary"}>
      {tEditor("charCount", { charCount, hardMax: limit.hardMax })}{" "}
      {tEditor("recommendedRange", {
        min: limit.recommendedMin,
        max: limit.recommendedMax,
      })}
    </Text>
  );

  return (
    <WritingExamShell
      title={tPage("pageTitle")}
      subtitle={tPage("pageSubtitle")}
      progressPercent={progressPercent}
      elapsedSeconds={elapsedSeconds}
      autosaveStatus={status}
      lastSavedAt={lastSavedAt}
      canSave={!submissionPending && state.text.length > 0 && !locked}
      canSubmit={
        submittable && Boolean(draftId) && !submissionPending && !locked
      }
      isSaving={status === "syncing" && upsert.isPending}
      isSubmitting={submissionPending}
      problemBookmark={{ userId, problemId: problem.id }}
      onSave={onManualSave}
      onSubmit={onOpenSubmitConfirm}
      onRequestBack={() =>
        exitGuard.requestNavigation(returnHref, { mode: "replace" })
      }
    >
      <div className="writing-workspace writing-workspace--q54">
        {staleDraftVersion &&
        draft &&
        canonicalQuestionId &&
        canonicalImportId &&
        canonicalPayloadHash ? (
          <StaleDraftVersionAlert
            draftId={draft.id}
            questionId={canonicalQuestionId}
            importId={canonicalImportId}
            payloadHash={canonicalPayloadHash}
          />
        ) : null}
        {problem.submitBlockedReason ? (
          <Alert
            type="warning"
            showIcon
            title={tEditor("submitBlockedProblemData")}
          />
        ) : null}

        <div className="writing-grid writing-grid--essay">
          <section
            className="writing-grid__support"
            aria-label={tPage("sourceAria")}
          >
            <QuestionPrompt problem={problem} />
            <ConditionsPanel
              questionNo={54}
              rubric={problem.rubric}
              loadFailed={
                problem.submitBlockedReason === "problem_data_incomplete"
              }
            />
            <WritingGuideAccordion
              className="writing-guide-accordion writing-guide-accordion--support"
              loadFailed={guideLoadFailed}
              loadFailedLabel={tGuide("loadFailedTag")}
              defaultActiveKeys={["guide"]}
              items={[
                {
                  key: "guide",
                  disabledOnLoadFailed: true,
                  className: "writing-guide-accordion__item--tutor",
                  icon: <Sparkles aria-hidden size={18} />,
                  title: tPage("guideTitle"),
                  children: (
                    <>
                      <p>{tPage("guideBody")}</p>
                      <ul className="writing-guide-list">
                        <li>{tPage("guideTip0")}</li>
                        <li>{tPage("guideTip1")}</li>
                      </ul>
                    </>
                  ),
                },
              ]}
            />
          </section>

          <section
            className="writing-grid__composer"
            aria-label={tPage("composerAria")}
          >
            <AppCard className="writing-composer-card">
              <div className="writing-answer-card__head">
                <div>
                  <Text strong>{tPage("editorTitle")}</Text>
                </div>
                <div className="writing-composer-mode">
                  {charCountUI}
                  <Segmented
                    size="small"
                    value={composerMode}
                    onChange={(value) => setComposerMode(value as ComposerMode)}
                    options={[
                      {
                        label: (
                          <span data-testid="q54-composer-mode-write">
                            {tPage("composerModeWrite")}
                          </span>
                        ),
                        value: "write",
                      },
                      {
                        label: (
                          <span data-testid="q54-composer-mode-manuscript">
                            {tPage("composerModeManuscript")}
                          </span>
                        ),
                        value: "manuscript",
                      },
                    ]}
                  />
                </div>
              </div>

              {composerMode === "write" ? (
                <div
                  className="writing-composer-panel writing-composer-panel--write"
                  data-testid="q54-composer-write-panel"
                >
                  <Progress
                    percent={progressPercent}
                    showInfo={false}
                    size="small"
                    status={inRecommended ? "success" : "active"}
                  />
                  <Input.TextArea
                    aria-label={tPage("answerInputAria")}
                    value={state.text}
                    onChange={(e) => onTextChange(e.target.value)}
                    onBlur={validateLength}
                    autoSize={{ minRows: 18 }}
                    maxLength={limit.hardMax}
                    placeholder={tEditor("essayBodyPlaceholder")}
                    disabled={submissionPending || locked}
                  />
                  {blurNotice ? (
                    <Text type="danger" className="writing-answer-card__notice">
                      {blurNotice}
                    </Text>
                  ) : null}
                </div>
              ) : (
                <div
                  className="writing-composer-panel writing-composer-panel--manuscript"
                  data-testid="q54-composer-manuscript-panel"
                >
                  <Progress
                    percent={progressPercent}
                    showInfo={false}
                    size="small"
                    status={inRecommended ? "success" : "active"}
                  />
                  <ManuscriptPreview text={state.text} showHeader={false} />
                </div>
              )}
            </AppCard>
          </section>

          <aside
            className="writing-grid__checklist"
            aria-label={tPage("checklistAria")}
          >
            <EssayStructureGuide
              guidance={problem.essayGuidance}
              loadFailed={guideLoadFailed}
              loadFailedLabel={tGuide("loadFailedTag")}
            />
          </aside>
        </div>

        <SubmissionConfirmModal
          open={confirmOpen}
          charCount={charCount}
          minChars={limit.hardMin}
          questionNo={54}
          lastSavedAt={lastSavedAt}
          loading={submissionPending}
          onConfirm={onConfirmSubmit}
          onCancel={() => {
            setSubmitError(null);
            setConfirmOpen(false);
          }}
        />
        <SubmissionFailedModal
          open={Boolean(submitError)}
          submitError={submitError}
          loading={submissionPending}
          onRetry={onRetrySubmitFailure}
          onClose={() => setSubmitError(null)}
        />
        <AutosaveWarningModal
          trigger={modalTrigger}
          lastSavedAt={lastSavedAt}
          retrying={upsert.isPending}
          recoveryState={resilience.state.recoveryState}
          onKeep={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.cancelPendingNavigation();
              return;
            }
            if (modalTrigger === "save_failure") {
              setFailureWarningDismissed(true);
            }
            setWarningTrigger(null);
          }}
          onRetry={() => {
            if (exitGuard.pendingNavigation) {
              void saveLatest("manual").then((saved) => {
                if (saved) exitGuard.proceedPendingNavigation();
              });
              return;
            }
            void saveLatest("retry");
          }}
          onProceed={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.proceedPendingNavigation();
              return;
            }
            if (modalTrigger === "save_failure") {
              setFailureWarningDismissed(true);
            }
            setWarningTrigger(null);
          }}
        />
        <WritingRecoveryConflictModal
          choosing={choosingRecovery}
          conflict={resilience.state.conflict}
          onChoose={onChooseRecovery}
        />
      </div>
    </WritingExamShell>
  );
}
