"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Collapse, Input, Progress, Typography } from "antd";
import {
  Eye,
  Lightbulb,
  PenLine,
  Plus,
  Sparkles,
} from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";

import { logStudyEvent } from "@/lib/events/study-events";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useWritingTimeMetrics } from "@/hooks/useWritingTimeMetrics";
import { recordWritingSubmissionMetrics } from "@/lib/writing/metrics";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import type {
  NormalizedBlank,
  NormalizedWritingProblem,
} from "@/lib/writing/problem-normalizer";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import {
  build51AnswerText,
  count51AnswerChars,
  isShortAnswer51DraftJson,
  type AutosaveStatus,
  type ShortAnswerQuestion51Json,
  type WritingDraftRow,
  type WritingRetrySeed,
} from "@/lib/writing/types";
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

type Q51Problem = Extract<NormalizedWritingProblem, { kind: "q51" }>;

type Props = {
  userId: string;
  problem: Q51Problem;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
};

const DEBOUNCE_MS = 2000;

function blankDisplay(blank: NormalizedBlank, index: number) {
  return `${index + 1} ${blank.label}`;
}

function initialBlankAnswers(
  blanks: NormalizedBlank[],
  draft: Pick<WritingDraftRow, "answer_json" | "answer_text"> | null,
): Record<string, string> {
  const draftJson = draft?.answer_json;
  if (isShortAnswer51DraftJson(draftJson)) {
    return Object.fromEntries(
      blanks.map((blank) => [blank.label, draftJson.blanks[blank.label] ?? ""]),
    );
  }

  return Object.fromEntries(
    blanks.map((blank, index) => [
      blank.label,
      index === 0 ? (draft?.answer_text ?? "") : "",
    ]),
  );
}

function uniqueNonEmpty(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]),
  );
}

function blankHintText(blank: NormalizedBlank, fallback: string) {
  const parts = uniqueNonEmpty([
    blank.targetHint,
    blank.role,
    blank.functionLabel,
    blank.answerType,
  ]);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

export function ShortAnswerWriting51Workspace({
  userId,
  problem,
  draft,
  retrySeed = null,
  parentSubmissionId = null,
}: Props) {
  const tPage = useTranslations("writing.q51");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const answerSource = retrySeed ?? draft;
  const [blankAnswers, setBlankAnswers] = useState<Record<string, string>>(() =>
    initialBlankAnswers(problem.blanks, answerSource),
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
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const { elapsedSeconds, markInputActivity, getTimeMetricsSnapshot } =
    useWritingTimeMetrics();
  const [activeBlankIndex, setActiveBlankIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();

  const limit = getCharLimit(51);
  const answerText = useMemo(
    () => build51AnswerText(blankAnswers, problem.blanks),
    [blankAnswers, problem.blanks],
  );
  const answerJson = useMemo<ShortAnswerQuestion51Json>(
    () => ({ _v: "51.v1", blanks: blankAnswers }),
    [blankAnswers],
  );
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(blankAnswers),
    [blankAnswers],
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
  const activeBlankValue = activeBlank
    ? (blankAnswers[activeBlank.label] ?? "")
    : "";
  const charCount = useMemo(
    () => count51AnswerChars(blankAnswers),
    [blankAnswers],
  );
  const submittable = isCountSubmittable(charCount, 51);
  const inRecommended = isCountInRecommendedRange(charCount, 51);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const expressionHints = [
    tPage("expressionHint0"),
    tPage("expressionHint1"),
    tPage("expressionHint2"),
    tPage("expressionHint3"),
    tPage("expressionHint4"),
  ];
  const guideMessages = useMemo(
    () => uniqueNonEmpty(problem.validationMessages),
    [problem.validationMessages],
  );
  const writingTips = useMemo(
    () =>
      uniqueNonEmpty([
        ...problem.rubric.conditions,
        ...problem.rubric.criteria,
      ]),
    [problem.rubric.conditions, problem.rubric.criteria],
  );
  const blankHints = useMemo(
    () =>
      problem.blanks
        .map((blank, index) => ({
          blank,
          index,
          hint: blankHintText(blank, tPage("answerHintFallback")),
        }))
        .filter(
          (
            item,
          ): item is { blank: NormalizedBlank; index: number; hint: string } =>
            Boolean(item.hint?.trim()),
        ),
    [problem.blanks, tPage],
  );

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId: problem.id,
      payload: { question_no: 51 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function persist(nextAnswers: Record<string, string>, isManual: boolean) {
    const nextText = build51AnswerText(nextAnswers, problem.blanks);
    const nextCharCount = count51AnswerChars(nextAnswers);
    const nextSnapshot = serializeWritingAnswerSnapshot(nextAnswers);
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problem.id,
        question_no: 51,
        answer_text: nextText,
        answer_json: { _v: "51.v1", blanks: nextAnswers },
        char_count: nextCharCount,
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
              payload: { question_no: 51, char_count: nextCharCount },
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

  function scheduleSave(nextAnswers: Record<string, string>) {
    if (!autosaveEnabled) {
      setStatus("dirty");
      return;
    }
    if (status !== "syncing") setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => persist(nextAnswers, false),
      DEBOUNCE_MS,
    );
  }

  function onChange(next: string) {
    if (!activeBlank) return;
    markInputActivity();
    const nextAnswers = { ...blankAnswers, [activeBlank.label]: next };
    setBlankAnswers(nextAnswers);
    setBlurNotice(null);
    scheduleSave(nextAnswers);
  }

  function onManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(blankAnswers, true);
  }

  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  function onBlurValidate() {
    if (answerText.length === 0) return;
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
        question_no: 51,
        parent_submission_id: parentSubmissionId,
        answer_text: answerText,
        answer_json: answerJson,
        passage_context: problem.blankedPrompt || problem.prompt,
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
            payload: { question_no: 51, char_count: charCount },
          });
          void recordWritingSubmissionMetrics({
            submissionId: result.submissionId,
            problemId: problem.id,
            questionNo: 51,
            ...getTimeMetricsSnapshot(),
          });
          setSubmittedAnalysis({
            submissionId: result.submissionId,
            questionNo: result.questionNo,
            answerText,
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
      canSave={!submit.isPending && charCount > 0}
      canSubmit={
        submittable &&
        !submit.isPending &&
        !Boolean(problem.submitBlockedReason)
      }
      isSaving={status === "syncing" && upsert.isPending}
      isSubmitting={submit.isPending}
      problemBookmark={{ userId, problemId: problem.id }}
      onSave={onManualSave}
      onSubmit={onOpenSubmitConfirm}
      onRequestBack={exitGuard.requestNavigation}
    >
      <div className="writing-workspace writing-workspace--q51">
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
                filled: (blankAnswers[blank.label] ?? "").trim().length > 0,
              }))}
              activeBlankIndex={activeBlankIndex}
              onSelectBlank={setActiveBlankIndex}
            />

            <section className="writing-answer-panel">
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

              <div className="writing-answer-card">
                <div className="writing-answer-card__head">
                  <div>
                    <Text strong>
                      {tPage("answerTitle", {
                        blank: activeBlank?.label ?? "ㄱ",
                      })}
                    </Text>
                    <Paragraph
                      type="secondary"
                      className="writing-answer-card__hint"
                    >
                      {activeBlank
                        ? blankHintText(
                            activeBlank,
                            tPage("answerHintFallback"),
                          )
                        : tPage("answerHintFallback")}
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
                  value={activeBlankValue}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlurValidate}
                  rows={4}
                  maxLength={limit.hardMax}
                  placeholder={tPage("answerPlaceholder", {
                    blank: activeBlank?.label ?? "ㄱ",
                  })}
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

                <Collapse
                  className="writing-expression-accordion"
                  bordered={false}
                  expandIconPlacement="end"
                  expandIcon={() => <Plus aria-hidden size={16} />}
                  items={[
                    {
                      key: "expression",
                      label: (
                        <div className="writing-guide-card__title">
                          <Lightbulb aria-hidden size={18} />
                          <Text strong>{tPage("expressionTitle")}</Text>
                        </div>
                      ),
                      children: (
                        <div className="writing-expression-content">
                          <div className="writing-expression-chip-list">
                            {expressionHints.map((hint) => (
                              <span
                                key={hint}
                                className="writing-expression-chip"
                              >
                                {hint}
                              </span>
                            ))}
                          </div>
                          <Button
                            size="small"
                            type="link"
                            onClick={onToggleAutosave}
                          >
                            {autosaveEnabled
                              ? tEditor("autosaveOff")
                              : tEditor("autosaveOn")}
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </section>
          </section>

          <aside className="writing-guide" aria-label={tPage("guideAria")}>
            <WritingGuideAccordion
              loadFailed={guideLoadFailed}
              loadFailedLabel={tGuide("loadFailedTag")}
              defaultActiveKeys={["guide", "tips", "hints"]}
              items={[
                {
                  key: "guide",
                  disabledOnLoadFailed: true,
                  className: "writing-guide-accordion__item--tutor",
                  icon: <Sparkles aria-hidden size={18} />,
                  title: tPage("guideTitle"),
                  children:
                    guideMessages.length > 0 ? (
                      <ul className="writing-guide-list">
                        {guideMessages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">{tPage("guidePlaceholder")}</Text>
                    ),
                },
                {
                  key: "tips",
                  disabledOnLoadFailed: true,
                  icon: <PenLine aria-hidden size={18} />,
                  title: tPage("tipsTitle"),
                  children:
                    writingTips.length > 0 ? (
                      <ul className="writing-guide-list">
                        {writingTips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">{tPage("tipsPlaceholder")}</Text>
                    ),
                },
                {
                  key: "hints",
                  disabledOnLoadFailed: true,
                  icon: <Eye aria-hidden size={18} />,
                  title: tPage("hintTitle"),
                  children:
                    blankHints.length > 0 ? (
                      <div className="writing-guide-hints">
                        {blankHints.map(({ blank, index, hint }) => (
                          <div key={blank.key} className="app-card-compact">
                            <Text strong>{blankDisplay(blank, index)}</Text>
                            <Text type="secondary">{hint}</Text>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">{tPage("hintPlaceholder")}</Text>
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
          questionNo={51}
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
              persist(blankAnswers, true);
              return;
            }
            setWarningTrigger(null);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            persist(blankAnswers, false);
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
