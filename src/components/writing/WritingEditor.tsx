"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import { logStudyEvent } from "@/lib/events/study-events";
import {
  isShortAnswer,
  type AutosaveStatus,
  type QuestionNo,
  type WritingDraftRow,
} from "@/lib/writing/types";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import { AutosaveBadge } from "./AutosaveBadge";
import { ConditionsPanel, type ProblemRubric } from "./ConditionsPanel";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SubmissionFailedModal } from "./SubmissionFailedModal";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";

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
  const [status, setStatus] = useState<AutosaveStatus>(
    initialDraft?.autosave_status ?? "clean",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialDraft?.last_saved_at ?? null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  // D-01/D-02 §4 — blur 검증 메시지(글자수 미달/초과 즉시 안내).
  const [blurNotice, setBlurNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAnalysis, setSubmittedAnalysis] =
    useState<SubmittedAnalysisState | null>(null);
  // D-M3 §5 — 자동 저장 on/off. 끄면 수동 임시 저장만 가능.
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();

  const limit = getCharLimit(questionNo);
  const charCount = useMemo(() => text.length, [text]);
  const submittable = isCountSubmittable(charCount, questionNo);
  const inRecommended = isCountInRecommendedRange(charCount, questionNo);
  const minChars = limit.hardMin;

  // D §study_events — 작성 시작(practice_started) 1회 기록.
  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId,
      payload: { question_no: questionNo },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // D-M3 / §1 예외 — 저장되지 않은 변경 상태에서 새로 고침/탭 닫기 시 브라우저
  // 기본 이탈 경고로 손실 방지.
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

  function persist(next: string, isManual: boolean) {
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: next,
        char_count: next.length,
        autosave_status: "clean",
        last_saved_at: new Date().toISOString(),
      },
      {
        onSuccess: (row) => {
          if (seq !== saveSeqRef.current) return;
          setStatus("clean");
          setLastSavedAt(row.last_saved_at ?? null);
          // D §study_events — 자동저장 성공 기록(수동 저장 제외).
          if (!isManual) {
            void logStudyEvent({
              eventType: "draft_autosaved",
              problemId,
              payload: { question_no: questionNo, char_count: next.length },
            });
          }
        },
        onError: () => {
          if (seq !== saveSeqRef.current) return;
          setStatus("failed");
          setWarningTrigger("save_failure");
        },
      },
    );
  }

  function scheduleSave(next: string) {
    // D-M3 §5 — 자동 저장이 꺼져 있으면 dirty 표시만 하고 자동 저장은 안 한다.
    if (!autosaveEnabled) {
      setStatus("dirty");
      return;
    }
    if (status !== "syncing") setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(next, false), DEBOUNCE_MS);
  }

  function onChange(next: string) {
    setText(next);
    setBlurNotice(null);
    scheduleSave(next);
  }

  // D-M3 §5 — '자동 저장 끄기' CTA → disable_attempt 경고. 사용자가 위험을
  // 인지하고 진행(onProceed)하면 자동 저장을 끈다. 실패 없이 즉시 적용되지만
  // 켜기 토글은 항상 가능.
  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  // D §5 — 임시 저장(수동)과 제출을 분리. 디바운스를 건너뛰고 즉시 저장.
  function onManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(text, true);
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

  function submitAnswer({
    clearFailure = true,
  }: { clearFailure?: boolean } = {}) {
    if (clearFailure) setSubmitError(null);
    submit.mutate(
      {
        draft_id: initialDraft?.id ?? null,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: text,
        char_count: charCount,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          setSubmitError(null);
          void logStudyEvent({
            eventType: "submission_submitted",
            problemId,
            submissionId: result.submissionId,
            payload: { question_no: questionNo, char_count: charCount },
          });
          const next = isShortAnswer(result.questionNo)
            ? `/writing/feedback/short/${result.submissionId}`
            : `/writing/feedback/long/${result.submissionId}`;
          setSubmittedAnalysis({
            submissionId: result.submissionId,
            questionNo: result.questionNo,
            answerText: text,
            charCount,
            submittedAt: new Date().toISOString(),
            feedbackHref: next,
          });
        },
        onError: (e) => {
          // D-M1 -> failure: API 실패 후 확인 모달을 닫고 별도 실패 모달로 전환한다.
          setConfirmOpen(false);
          setSubmitError(e.message);
        },
      },
    );
  }

  function onConfirmSubmit() {
    submitAnswer();
  }

  function onRetrySubmitFailure() {
    submitAnswer({ clearFailure: false });
  }

  if (submittedAnalysis) {
    return <SubmittedAnalysisPanel state={submittedAnalysis} />;
  }

  return (
    <Space orientation="vertical" size="middle" className="w-full">
      {/* D-02 §2 — 작성 조건 카드 (52번만; 51번은 지문 자체가 조건). */}
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
      <Input.TextArea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlurValidate}
        autoSize={{ minRows: isShortAnswer(questionNo) ? 3 : 12 }}
        maxLength={limit.hardMax}
        placeholder={
          isShortAnswer(questionNo)
            ? t("placeholderShort")
            : t("placeholderLong")
        }
        disabled={submit.isPending}
      />
      {/* §4 예외 — 글자수 미달/초과 blur 즉시 안내. */}
      {blurNotice ? (
        <Text type="danger" className="text-xs">
          {blurNotice}
        </Text>
      ) : null}

      {/* D §5 — 3-way: 임시 저장(수동) / 제출. (자동 저장은 상단 배지로 상시 노출) */}
      <Space>
        <Button
          onClick={onManualSave}
          loading={status === "syncing" && upsert.isPending}
          disabled={submit.isPending || text.length === 0}
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
            !submittable || submit.isPending || Boolean(submitBlockedReason)
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
        loading={submit.isPending}
        onConfirm={onConfirmSubmit}
        onCancel={() => {
          setSubmitError(null);
          setConfirmOpen(false);
        }}
      />
      <SubmissionFailedModal
        open={Boolean(submitError)}
        submitError={submitError}
        loading={submit.isPending}
        onRetry={onRetrySubmitFailure}
        onClose={() => setSubmitError(null)}
      />
      <AutosaveWarningModal
        trigger={warningTrigger}
        lastSavedAt={lastSavedAt}
        retrying={upsert.isPending}
        onKeep={() => setWarningTrigger(null)}
        onRetry={() => {
          setWarningTrigger(null);
          // 자동 저장이 꺼져 있더라도 '지금 다시 시도'는 즉시 저장한다.
          if (debounceRef.current) clearTimeout(debounceRef.current);
          persist(text, false);
        }}
        onProceed={() => {
          // disable_attempt 의 '위험을 알지만 끄기' → 자동 저장 끄기 확정.
          if (warningTrigger === "disable_attempt") {
            setAutosaveEnabled(false);
          }
          setWarningTrigger(null);
        }}
      />
    </Space>
  );
}
