"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Space, Tabs, Typography } from "antd";
import { useTranslations } from "next-intl";

import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import { logStudyEvent } from "@/lib/events/study-events";
import { useWritingResilience } from "@/lib/writing/use-writing-resilience";
import type { WritingResilienceSnapshot } from "@/lib/writing/writing-resilience";
import {
  combine53Sections,
  emptyChecklist,
  isLongFormDraftJson,
  type AutosaveStatus,
  type ChecklistItemStatus,
  type EssayChecklistKey,
  type LongFormDraftJson,
  type WritingDraftRow,
} from "@/lib/writing/types";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import { AppCard } from "@/components/shared/AppCard";
import { AutosaveBadge } from "./AutosaveBadge";
import { ConditionsPanel, type ProblemRubric } from "./ConditionsPanel";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SubmissionFailedModal } from "./SubmissionFailedModal";
import { SectionEditor } from "./SectionEditor";
import { ManuscriptPreview } from "./ManuscriptPreview";
import { EssayChecklist } from "./EssayChecklist";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { WritingRecoveryConflictModal } from "./WritingRecoveryConflictModal";

const { Text, Title } = Typography;

type Props = {
  userId: string;
  problemId: string;
  questionNo: 53 | 54;
  initialDraft: WritingDraftRow | null;
  rubric?: ProblemRubric;
  submitBlockedReason?: string | null;
};

const DEBOUNCE_MS = 2000;

type Question53State = {
  intro: string;
  body: string;
  conclusion: string;
};

type Question54State = {
  text: string;
  checklist: Record<EssayChecklistKey, ChecklistItemStatus>;
};
type LongFormAnswerSource = {
  answer_json?: unknown;
  answer_text?: string | null;
};

function readInitial53(draft: LongFormAnswerSource | null): Question53State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "53.v1"
  ) {
    return { ...draft.answer_json.sections };
  }
  return { intro: "", body: "", conclusion: "" };
}

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

export function LongFormEditor({
  userId,
  problemId,
  questionNo,
  initialDraft,
  rubric = null,
  submitBlockedReason = null,
}: Props) {
  const t = useTranslations("writing.editor");
  const initialState53 = useMemo(
    () => readInitial53(initialDraft),
    [initialDraft],
  );
  const initialState54 = useMemo(
    () => readInitial54(initialDraft),
    [initialDraft],
  );
  const [state53, setState53] = useState<Question53State>(() => initialState53);
  const [state54, setState54] = useState<Question54State>(() => initialState54);
  const [draftId, setDraftId] = useState<string | null>(
    initialDraft?.id ?? null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  const [failureWarningDismissed, setFailureWarningDismissed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAnalysis, setSubmittedAnalysis] =
    useState<SubmittedAnalysisState | null>(null);
  const [preparingSubmit, setPreparingSubmit] = useState(false);
  const [choosingRecovery, setChoosingRecovery] = useState<
    "prior" | "current" | null
  >(null);
  // D-M3 §5 — 자동 저장 on/off.
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const serverSaveKindRef = useRef<"auto" | "manual">("auto");
  const upsert = useUpsertDraft();

  function buildAnswerJson(
    state: Question53State | Question54State,
  ): LongFormDraftJson {
    if ("intro" in state) {
      return { _v: "53.v1", sections: { ...state } };
    }
    return {
      _v: "54.v1",
      text: state.text,
      checklist: { ...state.checklist },
    };
  }

  function createSnapshot(
    state: Question53State | Question54State,
    options: {
      autosaveStatus?: AutosaveStatus;
      draftId?: string | null;
      lastSavedAt?: string | null;
    } = {},
  ): WritingResilienceSnapshot {
    const answerJson = cloneLongFormDraftJson(buildAnswerJson(state));
    const answerText = "intro" in state ? combine53Sections(state) : state.text;
    return {
      draft: {
        user_id: userId,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: answerText,
        answer_json: answerJson,
        char_count: answerText.length,
        autosave_status: options.autosaveStatus ?? "clean",
        last_saved_at: options.lastSavedAt ?? null,
        canonical_question_id: initialDraft?.canonical_question_id ?? null,
        canonical_import_id: initialDraft?.canonical_import_id ?? null,
        canonical_payload_hash: initialDraft?.canonical_payload_hash ?? null,
      },
      draftId: options.draftId === undefined ? draftId : options.draftId,
    };
  }

  const initialEditorState =
    questionNo === 53 ? initialState53 : initialState54;
  const initialSnapshot = createSnapshot(initialEditorState, {
    autosaveStatus: initialDraft?.autosave_status ?? "clean",
    draftId: initialDraft?.id ?? null,
    lastSavedAt: initialDraft?.last_saved_at ?? null,
  });
  const resilience = useWritingResilience({
    debounceMs: DEBOUNCE_MS,
    initialSnapshot,
    onServerSaved: (row, snapshot) => {
      setDraftId(row.id);
      if (serverSaveKindRef.current === "auto") {
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
      serverSaveKindRef.current = "auto";
    },
    restorePrior: (record, current) => {
      if (!isLongFormDraftJson(record.answerJson)) return current;
      if (questionNo === 53 && record.answerJson._v === "53.v1") {
        const restoredState = readInitial53({
          answer_json: record.answerJson,
          answer_text: record.answerText,
        });
        const answerText = combine53Sections(restoredState);
        return {
          draft: {
            ...current.draft,
            answer_text: answerText,
            answer_json: cloneLongFormDraftJson(buildAnswerJson(restoredState)),
            char_count: answerText.length,
          },
          draftId: record.draftId,
        };
      }
      if (questionNo === 54 && record.answerJson._v === "54.v1") {
        const restoredState = readInitial54({
          answer_json: record.answerJson,
          answer_text: record.answerText,
        });
        return {
          draft: {
            ...current.draft,
            answer_text: restoredState.text,
            answer_json: cloneLongFormDraftJson(buildAnswerJson(restoredState)),
            char_count: restoredState.text.length,
          },
          draftId: record.draftId,
        };
      }
      return current;
    },
    saveServer: (nextDraft) => upsert.mutateAsync(nextDraft),
    serverAutosaveEnabled: autosaveEnabled,
  });
  const createEditedSnapshot = (nextState: Question53State | Question54State) =>
    createSnapshot(nextState, {
      autosaveStatus: "dirty",
      lastSavedAt: resilience.state.lastSavedAt,
    });
  const submit = useSubmitWriting(undefined, {
    intentPersistence: resilience.intentPersistence,
  });
  const status = resilience.state.status;
  const lastSavedAt = resilience.state.lastSavedAt;
  const submissionPending = submit.isPending || preparingSubmit;
  const modalTrigger: WarningTrigger | null =
    warningTrigger ??
    (resilience.state.hydrated &&
    status === "failed" &&
    !failureWarningDismissed
      ? "save_failure"
      : null);

  // D §study_events — 작성 시작(practice_started) 1회 기록.
  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId,
      payload: { question_no: questionNo },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limit = getCharLimit(questionNo);

  // Combined text for char count + submit payload.
  const combinedText = useMemo(
    () => (questionNo === 53 ? combine53Sections(state53) : state54.text),
    [questionNo, state53, state54.text],
  );
  const charCount = combinedText.length;
  const submittable = isCountSubmittable(charCount, questionNo);
  const inRecommended = isCountInRecommendedRange(charCount, questionNo);

  // D-M3 / description.md §1 예외 — 저장되지 않은 변경(또는 저장 실패)이 있는 상태에서
  // 새로 고침/탭 닫기 시 브라우저 이탈 경고로 손실을 방지. 장문(53/54)은 손실 위험이
  // 가장 크므로 단답 에디터와 동일하게 가드한다.
  useEffect(() => {
    const hasUnsaved = status === "dirty" || status === "failed";
    if (!hasUnsaved) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  async function saveLatest(kind: "manual" | "retry") {
    const latestState = questionNo === 53 ? state53 : state54;
    resilience.edit(createEditedSnapshot(latestState), {
      scheduleServer: false,
    });
    serverSaveKindRef.current = kind === "manual" ? "manual" : "auto";
    try {
      if (kind === "manual") await resilience.manualSave();
      else await resilience.retry();
      setWarningTrigger(null);
    } catch {
      setWarningTrigger("save_failure");
    } finally {
      serverSaveKindRef.current = "auto";
    }
  }

  function onManualSave() {
    void saveLatest("manual");
  }

  // D-M3 §5 — 자동 저장 끄기/켜기.
  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  function onSection53Change(key: keyof Question53State, next: string) {
    const nextState: Question53State = { ...state53, [key]: next };
    setState53(nextState);
    setFailureWarningDismissed(false);
    resilience.edit(createEditedSnapshot(nextState));
  }

  function onText54Change(next: string) {
    const nextState: Question54State = { ...state54, text: next };
    setState54(nextState);
    setFailureWarningDismissed(false);
    resilience.edit(createEditedSnapshot(nextState));
  }

  function onChecklist54Change(
    key: EssayChecklistKey,
    next: ChecklistItemStatus,
  ) {
    const nextChecklist = { ...state54.checklist, [key]: next };
    const nextState: Question54State = {
      ...state54,
      checklist: nextChecklist,
    };
    setState54(nextState);
    setFailureWarningDismissed(false);
    resilience.edit(createEditedSnapshot(nextState));
  }

  // disable_attempt 의 '위험을 알지만 끄기' 처리.
  function onWarningProceed() {
    if (warningTrigger === "disable_attempt") {
      setAutosaveEnabled(false);
    }
    if (modalTrigger === "save_failure") {
      setFailureWarningDismissed(true);
    }
    setWarningTrigger(null);
  }

  async function submitAnswer({
    clearFailure = true,
  }: { clearFailure?: boolean } = {}) {
    if (clearFailure) setSubmitError(null);
    const latestState = questionNo === 53 ? state53 : state54;
    setPreparingSubmit(true);
    resilience.edit(createEditedSnapshot(latestState), {
      scheduleServer: false,
    });
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
          problem_id: problemId,
          question_no: questionNo,
          answer_text: answerText,
          answer_json: JSON.parse(JSON.stringify(prepared.draft.answer_json)),
          char_count: preparedCharCount,
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
                char_count: preparedCharCount,
              },
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
      if (questionNo === 53) {
        setState53(readInitial53(selected.draft));
      } else {
        setState54(readInitial54(selected.draft));
      }
      setDraftId(selected.draftId);
    } finally {
      setChoosingRecovery(null);
    }
  }

  const charCountUI = (
    <Text type={inRecommended ? "success" : "secondary"}>
      {t("charCount", { charCount, hardMax: limit.hardMax })}{" "}
      {t("recommendedRange", {
        min: limit.recommendedMin,
        max: limit.recommendedMax,
      })}
      {inRecommended ? " ✓" : ""}
    </Text>
  );

  if (submittedAnalysis) {
    return <SubmittedAnalysisPanel state={submittedAnalysis} />;
  }

  return (
    <Space orientation="vertical" size="middle" className="w-full">
      {/* D-03 평가 기준 / D-04 조건·루브릭 카드 (problems.rubric). */}
      <ConditionsPanel
        questionNo={questionNo}
        rubric={rubric}
        loadFailed={submitBlockedReason === "problem_data_incomplete"}
      />
      {submitBlockedReason ? (
        <Alert type="warning" showIcon title={t("submitBlockedProblemData")} />
      ) : null}

      <Space wrap>
        <AutosaveBadge status={status} lastSavedAt={lastSavedAt} />
        {charCountUI}
        {/* D-M3 §5 — 자동 저장 끄기/켜기 CTA. */}
        <Button size="small" type="link" onClick={onToggleAutosave}>
          {autosaveEnabled ? t("autosaveOff") : t("autosaveOn")}
        </Button>
      </Space>
      {!autosaveEnabled ? (
        <Text type="warning" className="text-xs">
          {t("autosaveDisabledNotice")}
        </Text>
      ) : null}

      {questionNo === 53 ? (
        <>
          <Tabs
            items={[
              {
                key: "intro",
                label: t("tab53Intro"),
                children: (
                  <SectionEditor
                    label={t("section53IntroLabel")}
                    value={state53.intro}
                    onChange={(v) => onSection53Change("intro", v)}
                    placeholder={t("section53IntroPlaceholder")}
                  />
                ),
              },
              {
                key: "body",
                label: t("tab53Body"),
                children: (
                  <SectionEditor
                    label={t("section53BodyLabel")}
                    value={state53.body}
                    onChange={(v) => onSection53Change("body", v)}
                    placeholder={t("section53BodyPlaceholder")}
                    minRows={6}
                  />
                ),
              },
              {
                key: "conclusion",
                label: t("tab53Conclusion"),
                children: (
                  <SectionEditor
                    label={t("section53ConclusionLabel")}
                    value={state53.conclusion}
                    onChange={(v) => onSection53Change("conclusion", v)}
                    placeholder={t("section53ConclusionPlaceholder")}
                  />
                ),
              },
            ]}
          />
          <ManuscriptPreview text={combinedText} />
        </>
      ) : (
        // 좁은 화면은 1열, 넓을 때만 본문 + 체크리스트로 배치한다.
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <AppCard>
            <Title level={5}>{t("essayBodyTitle")}</Title>
            <Input.TextArea
              aria-label={t("essayBodyAria")}
              value={state54.text}
              onChange={(e) => onText54Change(e.target.value)}
              autoSize={{ minRows: 12 }}
              maxLength={limit.hardMax}
              placeholder={t("essayBodyPlaceholder")}
              disabled={submissionPending || Boolean(resilience.state.conflict)}
            />
          </AppCard>
          <EssayChecklist
            status={state54.checklist}
            onChange={onChecklist54Change}
          />
        </div>
      )}

      {/* D §5 — 자동저장(상단 배지) / 수동 임시저장 / 최종 제출 3-way 분리. */}
      <Space className="self-start">
        <Button
          onClick={onManualSave}
          loading={status === "syncing" && upsert.isPending}
          disabled={
            submissionPending ||
            combinedText.length === 0 ||
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
            !draftId ||
            submissionPending ||
            Boolean(resilience.state.conflict) ||
            Boolean(submitBlockedReason)
          }
        >
          {t("submit")}
        </Button>
      </Space>
      <SubmissionConfirmModal
        open={confirmOpen}
        charCount={charCount}
        minChars={limit.hardMin}
        questionNo={questionNo}
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
          if (modalTrigger === "save_failure") {
            setFailureWarningDismissed(true);
          }
          setWarningTrigger(null);
        }}
        onRetry={() => void saveLatest("retry")}
        onProceed={onWarningProceed}
      />
      <WritingRecoveryConflictModal
        choosing={choosingRecovery}
        conflict={resilience.state.conflict}
        onChoose={onChooseRecovery}
      />
    </Space>
  );
}
