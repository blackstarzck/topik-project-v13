"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Space, Tabs, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  useSubmitWriting,
  useUpsertDraft,
} from "@/lib/writing/mutations";
import { logStudyEvent } from "@/lib/events/study-events";
import {
  combine53Sections,
  emptyChecklist,
  isLongFormDraftJson,
  type ChecklistItemStatus,
  type EssayChecklistKey,
  type LongFormDraftJson,
  type WritingDraftRow,
  type AutosaveStatus,
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
import { SectionEditor } from "./SectionEditor";
import { ManuscriptPreview } from "./ManuscriptPreview";
import { EssayChecklist } from "./EssayChecklist";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";

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

function readInitial53(draft: WritingDraftRow | null): Question53State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "53.v1"
  ) {
    return { ...draft.answer_json.sections };
  }
  return { intro: "", body: "", conclusion: "" };
}

function readInitial54(draft: WritingDraftRow | null): Question54State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "54.v1"
  ) {
    return {
      text: draft.answer_json.text,
      checklist: draft.answer_json.checklist,
    };
  }
  return { text: draft?.answer_text ?? "", checklist: emptyChecklist() };
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
  const [state53, setState53] = useState<Question53State>(() =>
    readInitial53(initialDraft),
  );
  const [state54, setState54] = useState<Question54State>(() =>
    readInitial54(initialDraft),
  );
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  // D-M3 §5 — 자동 저장 on/off.
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();
  const router = useRouter();

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
    () =>
      questionNo === 53
        ? combine53Sections(state53)
        : state54.text,
    [questionNo, state53, state54.text],
  );
  const charCount = combinedText.length;
  const submittable = isCountSubmittable(charCount, questionNo);
  const inRecommended = isCountInRecommendedRange(charCount, questionNo);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

  function buildAnswerJson(): LongFormDraftJson {
    if (questionNo === 53) {
      return { _v: "53.v1", sections: state53 };
    }
    return {
      _v: "54.v1",
      text: state54.text,
      checklist: state54.checklist,
    };
  }

  // scheduleSave accepts the latest draft snapshot to avoid stale closure
  // capture (Codex Round 1 P1-1). React setState is async; calling
  // scheduleSave() right after setStateXX(...) would otherwise read pre-update
  // combinedText / buildAnswerJson() and persist obsolete data.
  function persist(
    nextJson: LongFormDraftJson,
    nextText: string,
    isManual: boolean,
  ) {
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: nextText,
        answer_json: JSON.parse(JSON.stringify(nextJson)),
        char_count: nextText.length,
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
              payload: { question_no: questionNo, char_count: nextText.length },
            });
          }
        },
        onError: () => {
          if (seq !== saveSeqRef.current) return;
          setStatus("failed");
          // D-M3 / §1 예외 — 토스트 대신 복구 가능한 경고 모달.
          setWarningTrigger("save_failure");
        },
      },
    );
  }

  function scheduleSave(nextJson: LongFormDraftJson, nextText: string) {
    // D-M3 §5 — 자동 저장 꺼짐: dirty 표시만, 자동 저장은 안 함.
    if (!autosaveEnabled) {
      setStatus("dirty");
      return;
    }
    if (status !== "syncing") setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => persist(nextJson, nextText, false),
      DEBOUNCE_MS,
    );
  }

  // D §5 — 수동 임시 저장(디바운스 건너뜀, 즉시 저장).
  function onManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(buildAnswerJson(), combinedText, true);
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
    const nextJson: LongFormDraftJson = {
      _v: "53.v1",
      sections: nextState,
    };
    scheduleSave(nextJson, combine53Sections(nextState));
  }

  function onText54Change(next: string) {
    const nextState: Question54State = { ...state54, text: next };
    setState54(nextState);
    const nextJson: LongFormDraftJson = {
      _v: "54.v1",
      text: nextState.text,
      checklist: nextState.checklist,
    };
    scheduleSave(nextJson, nextState.text);
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
    const nextJson: LongFormDraftJson = {
      _v: "54.v1",
      text: nextState.text,
      checklist: nextState.checklist,
    };
    scheduleSave(nextJson, nextState.text);
  }

  // D-M3 retry — 현재 작성 상태 스냅샷으로 저장을 다시 시도(자동저장 off 여도 즉시 저장).
  function retrySaveNow() {
    setWarningTrigger(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(buildAnswerJson(), combinedText, false);
  }

  // disable_attempt 의 '위험을 알지만 끄기' 처리.
  function onWarningProceed() {
    if (warningTrigger === "disable_attempt") {
      setAutosaveEnabled(false);
    }
    setWarningTrigger(null);
  }

  function onConfirmSubmit() {
    setSubmitError(null);
    submit.mutate(
      {
        draft_id: initialDraft?.id ?? null,
        problem_id: problemId,
        question_no: questionNo,
        answer_text: combinedText,
        // Persist long-form sections / checklist alongside flattened answer_text
        // (Codex Round 1 P1-3).
        answer_json: JSON.parse(JSON.stringify(buildAnswerJson())),
        char_count: charCount,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          void logStudyEvent({
            eventType: "submission_submitted",
            problemId,
            submissionId: result.submissionId,
            payload: { question_no: questionNo, char_count: charCount },
          });
          router.push(`/writing/feedback/long/${result.submissionId}`);
        },
        onError: (e) => {
          // D-M1 §4 예외 — 제출 실패 시 확인 모달을 유지하고 모달 안에서 원인 +
          // 재시도 노출(닫지 않는다).
          setSubmitError(e.message);
        },
      },
    );
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

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {/* D-03 평가 기준 / D-04 조건·루브릭 카드 (problems.rubric). */}
      <ConditionsPanel
        questionNo={questionNo}
        rubric={rubric}
        loadFailed={submitBlockedReason === "problem_data_incomplete"}
      />
      {submitBlockedReason ? (
        <Alert
          type="warning"
          showIcon
          title={t("submitBlockedProblemData")}
        />
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
        <Text type="warning" style={{ fontSize: 12 }}>
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
        <div
          style={{
            display: "grid",
            gap: 16,
            // 반응형: 좁은 화면에서는 본문/체크리스트가 1열로 쌓이고, 넓을 때만
            // 2열(본문 + 320px 체크리스트). 고정 폭의 360px 가로 넘침 해소.
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <AppCard>
            <Title level={5}>{t("essayBodyTitle")}</Title>
            <Input.TextArea
              aria-label={t("essayBodyAria")}
              value={state54.text}
              onChange={(e) => onText54Change(e.target.value)}
              autoSize={{ minRows: 12 }}
              maxLength={limit.hardMax}
              placeholder={t("essayBodyPlaceholder")}
              disabled={submit.isPending}
            />
          </AppCard>
          <EssayChecklist
            status={state54.checklist}
            onChange={onChecklist54Change}
          />
        </div>
      )}

      {/* D §5 — 자동저장(상단 배지) / 수동 임시저장 / 최종 제출 3-way 분리. */}
      <Space style={{ alignSelf: "flex-start" }}>
        <Button
          onClick={onManualSave}
          loading={status === "syncing" && upsert.isPending}
          disabled={submit.isPending || combinedText.length === 0}
        >
          {t("saveDraft")}
        </Button>
        <Button
          type="primary"
          onClick={() => setConfirmOpen(true)}
          disabled={!submittable || submit.isPending || Boolean(submitBlockedReason)}
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
        loading={submit.isPending}
        submitError={submitError}
        onConfirm={onConfirmSubmit}
        onCancel={() => {
          setSubmitError(null);
          setConfirmOpen(false);
        }}
      />
      <AutosaveWarningModal
        trigger={warningTrigger}
        lastSavedAt={lastSavedAt}
        retrying={upsert.isPending}
        onKeep={() => setWarningTrigger(null)}
        onRetry={retrySaveNow}
        onProceed={onWarningProceed}
      />
    </Space>
  );
}
