"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Progress, Typography } from "antd";
import { Lightbulb, PenLine, Sparkles } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";

import { logStudyEvent } from "@/lib/events/study-events";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import type {
  NormalizedBlank,
  NormalizedWritingProblem,
} from "@/lib/writing/problem-normalizer";
import type { AutosaveStatus, WritingDraftRow } from "@/lib/writing/types";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import { InteractiveBlankPrompt } from "./InteractiveBlankPrompt";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SubmissionFailedModal } from "./SubmissionFailedModal";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { WritingGuideAccordion } from "./WritingGuideAccordion";
import { WritingExamShell } from "./WritingExamShell";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

const { Text, Paragraph } = Typography;

type Q52Problem = Extract<NormalizedWritingProblem, { kind: "q52" }>;

type Props = {
  userId: string;
  problem: Q52Problem;
  draft: WritingDraftRow | null;
};

const DEBOUNCE_MS = 2000;

function blankDisplay(blank: NormalizedBlank, index: number) {
  return `${index + 1} ${blank.label}`;
}

function uniqueNonEmpty(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]),
  );
}

export function ShortAnswerWriting52Workspace({
  userId,
  problem,
  draft,
}: Props) {
  const tPage = useTranslations("writing.q52");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const [text, setText] = useState(draft?.answer_text ?? "");
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
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeBlankIndex, setActiveBlankIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();

  const limit = getCharLimit(52);
  const charCount = useMemo(() => text.length, [text]);
  const submittable = isCountSubmittable(charCount, 52);
  const inRecommended = isCountInRecommendedRange(charCount, 52);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(text),
    [text],
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
  const activeBlank = problem.blanks[activeBlankIndex] ?? problem.blanks[0];

  const expressionHints = [
    tPage("expressionHint0"),
    tPage("expressionHint1"),
    tPage("expressionHint2"),
    tPage("expressionHint3"),
    tPage("expressionHint4"),
  ];
  const conditionItems = useMemo(
    () => uniqueNonEmpty(problem.rubric.conditions.slice(0, 4)),
    [problem.rubric.conditions],
  );
  const guideMessages = useMemo(
    () => uniqueNonEmpty(problem.validationMessages.slice(0, 2)),
    [problem.validationMessages],
  );

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId: problem.id,
      payload: { question_no: 52 },
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

  function persist(next: string, isManual: boolean) {
    const nextSnapshot = serializeWritingAnswerSnapshot(next);
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problem.id,
        question_no: 52,
        answer_text: next,
        char_count: next.length,
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
              payload: { question_no: 52, char_count: next.length },
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

  function onManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(text, true);
  }

  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  function onBlurValidate() {
    if (text.length === 0) return;
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

  function onOpenSubmitConfirm() {
    onBlurValidate();
    if (!submittable || problem.submitBlockedReason) return;
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
        question_no: 52,
        answer_text: text,
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
            payload: { question_no: 52, char_count: charCount },
          });
          setSubmittedAnalysis({
            submissionId: result.submissionId,
            questionNo: result.questionNo,
            answerText: text,
            charCount,
            submittedAt: new Date().toISOString(),
            feedbackHref: `/writing/feedback/short/${result.submissionId}`,
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

  return (
    <WritingExamShell
      title={tPage("pageTitle")}
      subtitle={tPage("pageSubtitle")}
      progressPercent={progressPercent}
      elapsedSeconds={elapsedSeconds}
      autosaveStatus={status}
      lastSavedAt={lastSavedAt}
      canSave={!submit.isPending && text.length > 0}
      canSubmit={
        submittable &&
        !submit.isPending &&
        !Boolean(problem.submitBlockedReason)
      }
      isSaving={status === "syncing" && upsert.isPending}
      isSubmitting={submit.isPending}
      onSave={onManualSave}
      onSubmit={onOpenSubmitConfirm}
      onRequestBack={exitGuard.requestNavigation}
    >
      <div className="writing-workspace writing-workspace--q52">
        {problem.submitBlockedReason ? (
          <Alert
            type="warning"
            showIcon
            title={tEditor("submitBlockedProblemData")}
          />
        ) : null}

        <div className="writing-grid">
          <section
            className="writing-grid__main"
            aria-label={tPage("mainAria")}
          >
            <InteractiveBlankPrompt
              title={problem.title}
              textType={problem.textType}
              questionNo={problem.questionNo}
              prompt={problem.blankedPrompt || problem.prompt}
              blanks={problem.blanks.map((blank) => ({
                key: blank.key,
                label: blank.label,
                filled: false,
              }))}
              activeBlankIndex={activeBlankIndex}
              onSelectBlank={setActiveBlankIndex}
            />

            <section className="writing-answer-panel">
              {problem.blanks.length > 0 ? (
                <div
                  className="writing-blank-tabs"
                  role="tablist"
                  aria-label={tPage("blankTabsLabel")}
                >
                  {problem.blanks.map((blank, index) => (
                    <button
                      key={blank.key}
                      type="button"
                      role="tab"
                      aria-selected={index === activeBlankIndex}
                      className={
                        index === activeBlankIndex
                          ? "writing-blank-tab writing-blank-tab--active"
                          : "writing-blank-tab"
                      }
                      onClick={() => setActiveBlankIndex(index)}
                    >
                      {blankDisplay(blank, index)}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="writing-answer-card">
                <div className="writing-answer-card__head">
                  <div>
                    <Text strong>{tPage("answerTitle")}</Text>
                    <Paragraph
                      type="secondary"
                      className="writing-answer-card__hint"
                    >
                      {activeBlank?.targetHint ??
                        activeBlank?.role ??
                        tPage("answerHintFallback")}
                    </Paragraph>
                  </div>
                  <Text type={inRecommended ? "success" : "secondary"}>
                    {tEditor("charCount", {
                      charCount,
                      hardMax: limit.hardMax,
                    })}{" "}
                    {tEditor("minOnly", { min: limit.hardMin })}
                    {inRecommended ? " ✓" : ""}
                  </Text>
                </div>

                <Input.TextArea
                  value={text}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlurValidate}
                  autoSize={{ minRows: 5 }}
                  maxLength={limit.hardMax}
                  placeholder={tPage("answerPlaceholder")}
                  disabled={submit.isPending}
                  aria-label={tPage("answerInputAria")}
                />
                <Progress
                  percent={progressPercent}
                  showInfo={false}
                  size="small"
                  status={inRecommended ? "success" : "active"}
                />
                {blurNotice ? (
                  <Text type="danger" className="writing-answer-card__notice">
                    {blurNotice}
                  </Text>
                ) : null}
                {!autosaveEnabled ? (
                  <Text type="warning" className="writing-answer-card__notice">
                    {tEditor("autosaveDisabledNotice")}
                  </Text>
                ) : null}
                <div className="writing-answer-card__actions">
                  <Button size="small" type="link" onClick={onToggleAutosave}>
                    {autosaveEnabled
                      ? tEditor("autosaveOff")
                      : tEditor("autosaveOn")}
                  </Button>
                </div>
              </div>
            </section>
          </section>

          <aside className="writing-guide" aria-label={tPage("guideAria")}>
            <WritingGuideAccordion
              loadFailed={guideLoadFailed}
              loadFailedLabel={tGuide("loadFailedTag")}
              defaultActiveKeys={["conditions", "guide", "examples"]}
              items={[
                {
                  key: "conditions",
                  disabledOnLoadFailed: true,
                  className: "writing-guide-accordion__item--tutor",
                  icon: <Sparkles aria-hidden size={18} />,
                  title: tPage("guideTitle"),
                  children:
                    conditionItems.length > 0 ? (
                      <ul className="writing-guide-list">
                        {conditionItems.map((condition) => (
                          <li key={condition}>{condition}</li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">{tPage("conditionFallback")}</Text>
                    ),
                },
                {
                  key: "guide",
                  disabledOnLoadFailed: true,
                  icon: <PenLine aria-hidden size={18} />,
                  title: tPage("tipsTitle"),
                  children:
                    guideMessages.length > 0 ? (
                      <ul className="writing-guide-list">
                        {guideMessages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">{tPage("guideFallback")}</Text>
                    ),
                },
                {
                  key: "examples",
                  disabledOnLoadFailed: true,
                  icon: <Lightbulb aria-hidden size={18} />,
                  title: tPage("hintTitle"),
                  children: (
                    <ul className="writing-guide-list writing-guide-list--examples">
                      {expressionHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                  ),
                },
              ]}
            />
          </aside>
        </div>

        <SubmissionConfirmModal
          open={confirmOpen}
          charCount={charCount}
          minChars={limit.hardMin}
          questionNo={52}
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
              persist(text, true);
              return;
            }
            setWarningTrigger(null);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            persist(text, false);
          }}
          onProceed={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.proceedPendingNavigation();
              return;
            }
            if (warningTrigger === "disable_attempt") {
              setAutosaveEnabled(false);
            }
            setWarningTrigger(null);
          }}
        />
      </div>
    </WritingExamShell>
  );
}
