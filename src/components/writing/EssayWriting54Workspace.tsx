"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Input, Progress, Segmented, Typography } from "antd";
import { Sparkles } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";

import { AppCard } from "@/components/shared/AppCard";
import { logStudyEvent } from "@/lib/events/study-events";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
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
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { WritingGuideAccordion } from "./WritingGuideAccordion";
import { WritingExamShell } from "./WritingExamShell";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

const { Text } = Typography;

type Q54Problem = Extract<NormalizedWritingProblem, { kind: "q54" }>;

type Props = {
  userId: string;
  problem: Q54Problem;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
};

type Question54State = {
  text: string;
  checklist: Record<EssayChecklistKey, ChecklistItemStatus>;
};

type ComposerMode = "write" | "manuscript";

const DEBOUNCE_MS = 2000;

function readInitial54(
  draft: Pick<WritingDraftRow, "answer_json" | "answer_text"> | null,
): Question54State {
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

function build54Json(state: Question54State): LongFormDraftJson {
  return {
    _v: "54.v1",
    text: state.text,
    checklist: state.checklist,
  };
}

export function EssayWriting54Workspace({
  userId,
  problem,
  draft,
  retrySeed = null,
  parentSubmissionId = null,
}: Props) {
  const tPage = useTranslations("writing.q54");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const answerSource = retrySeed ?? draft;
  const [state, setState] = useState<Question54State>(() =>
    readInitial54(answerSource),
  );
  const [status, setStatus] = useState<AutosaveStatus>(
    draft?.autosave_status ?? "clean",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    draft?.last_saved_at ?? null,
  );
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<WarningTrigger | null>(
    null,
  );
  const [blurNotice, setBlurNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAnalysis, setSubmittedAnalysis] =
    useState<SubmittedAnalysisState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [composerMode, setComposerMode] = useState<ComposerMode>("write");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();

  const limit = getCharLimit(54);
  const charCount = state.text.length;
  const submittable = isCountSubmittable(charCount, 54);
  const inRecommended = isCountInRecommendedRange(charCount, 54);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const locked = Boolean(problem.submitBlockedReason);
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(build54Json(state)),
    [state],
  );
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    () => currentAnswerSnapshot,
  );
  const hasUnsavedAnswerChange = currentAnswerSnapshot !== lastSavedSnapshot;
  const exitGuard = useUnsavedChangesGuard({
    when: hasUnsavedAnswerChange,
    fallbackHref: "/practice/problems",
  });
  const modalTrigger: WarningTrigger | null = exitGuard.pendingNavigation
    ? "exit_with_dirty"
    : warningTrigger;
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

  function persist(
    nextState: Question54State,
    nextText: string,
    isManual: boolean,
  ) {
    const nextSnapshot = serializeWritingAnswerSnapshot(build54Json(nextState));
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problem.id,
        question_no: 54,
        answer_text: nextText,
        answer_json: JSON.parse(JSON.stringify(build54Json(nextState))),
        char_count: nextText.length,
        autosave_status: "clean",
        last_saved_at: new Date().toISOString(),
      },
      {
        onSuccess: (row) => {
          if (seq !== saveSeqRef.current) return;
          setLastSavedSnapshot(nextSnapshot);
          setStatus("clean");
          setDraftId(row.id);
          setLastSavedAt(row.last_saved_at ?? null);
          if (!isManual) {
            void logStudyEvent({
              eventType: "draft_autosaved",
              problemId: problem.id,
              payload: { question_no: 54, char_count: nextText.length },
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

  function scheduleSave(nextState: Question54State) {
    if (status !== "syncing") setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => persist(nextState, nextState.text, false),
      DEBOUNCE_MS,
    );
  }

  function onTextChange(next: string) {
    const nextState = { ...state, text: next };
    setState(nextState);
    setBlurNotice(null);
    scheduleSave(nextState);
  }

  function onManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(state, state.text, true);
  }

  function onOpenSubmitConfirm() {
    validateLength();
    if (!submittable || locked) return;
    setSubmitError(null);
    setConfirmOpen(true);
  }

  function submitAnswer({
    clearFailure = true,
  }: { clearFailure?: boolean } = {}) {
    if (clearFailure) setSubmitError(null);
    submit.mutate(
      {
        draft_id: draftId,
        problem_id: problem.id,
        question_no: 54,
        parent_submission_id: parentSubmissionId,
        answer_text: state.text,
        answer_json: JSON.parse(JSON.stringify(build54Json(state))),
        char_count: charCount,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          setSubmitError(null);
          void logStudyEvent({
            eventType: "submission_submitted",
            problemId: problem.id,
            submissionId: result.submissionId,
            payload: { question_no: 54, char_count: charCount },
          });
          setSubmittedAnalysis({
            submissionId: result.submissionId,
            questionNo: result.questionNo,
            answerText: state.text,
            charCount,
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
      canSave={!submit.isPending && state.text.length > 0 && !locked}
      canSubmit={submittable && !submit.isPending && !locked}
      isSaving={status === "syncing" && upsert.isPending}
      isSubmitting={submit.isPending}
      onSave={onManualSave}
      onSubmit={onOpenSubmitConfirm}
      onRequestBack={exitGuard.requestNavigation}
    >
      <div className="writing-workspace writing-workspace--q54">
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
                    disabled={submit.isPending || locked}
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
          trigger={modalTrigger}
          lastSavedAt={lastSavedAt}
          retrying={upsert.isPending}
          onKeep={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.cancelPendingNavigation();
              return;
            }
            setWarningTrigger(null);
          }}
          onRetry={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.cancelPendingNavigation();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              persist(state, state.text, true);
              return;
            }
            setWarningTrigger(null);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            persist(state, state.text, false);
          }}
          onProceed={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.proceedPendingNavigation();
              return;
            }
            setWarningTrigger(null);
          }}
        />
      </div>
    </WritingExamShell>
  );
}
