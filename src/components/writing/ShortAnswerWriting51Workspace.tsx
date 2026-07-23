"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Descriptions, Input, Progress, Typography } from "antd";
import { Eye, PenLine, Sparkles } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";

import { logStudyEvent } from "@/lib/events/study-events";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useWritingTimeMetrics } from "@/hooks/useWritingTimeMetrics";
import type { ClientRecoveryRecordV1 } from "@/lib/writing/client-recovery";
import { recordWritingSubmissionMetrics } from "@/lib/writing/metrics";
import { isWritingDraftVersionStale } from "@/lib/writing/draft-version";
import { useSubmitWriting, useUpsertDraft } from "@/lib/writing/mutations";
import { useWritingResilience } from "@/lib/writing/use-writing-resilience";
import type { WritingResilienceSnapshot } from "@/lib/writing/writing-resilience";
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
import { StaleDraftVersionAlert } from "./StaleDraftVersionAlert";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { WritingGuideAccordion } from "./WritingGuideAccordion";
import { WritingExamShell } from "./WritingExamShell";
import { WritingRecoveryConflictModal } from "./WritingRecoveryConflictModal";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

const { Text, Paragraph } = Typography;

type Q51Problem = Extract<NormalizedWritingProblem, { kind: "q51" }>;

type Props = {
  userId: string;
  problem: Q51Problem;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
  returnHref: string;
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

function blankHintText(blank: NormalizedBlank) {
  const parts = uniqueNonEmpty([
    blank.role,
    blank.functionLabel,
    blank.answerType,
  ]);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ShortAnswerWriting51Workspace({
  userId,
  problem,
  draft,
  retrySeed = null,
  parentSubmissionId = null,
  returnHref,
}: Props) {
  const tPage = useTranslations("writing.q51");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const answerSource = retrySeed ?? draft;
  const initialAnswers = useMemo(
    () => initialBlankAnswers(problem.blanks, answerSource),
    [answerSource, problem.blanks],
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
    useState<Record<string, string>>(initialAnswers);
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
  const [recoveryChoice, setRecoveryChoice] = useState<
    "prior" | "current" | null
  >(null);
  const draftIdRef = useRef<string | null>(draft?.id ?? null);
  const explicitSaveRef = useRef<"manual" | "submit" | null>(null);
  const upsert = useUpsertDraft();

  const limit = getCharLimit(51);
  const answerText = useMemo(
    () => build51AnswerText(blankAnswers, problem.blanks),
    [blankAnswers, problem.blanks],
  );
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(blankAnswers),
    [blankAnswers],
  );
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    () => currentAnswerSnapshot,
  );
  const initialSnapshot = useMemo<WritingResilienceSnapshot>(
    () => ({
      draft: {
        user_id: userId,
        problem_id: problem.id,
        question_no: 51,
        answer_text: build51AnswerText(initialAnswers, problem.blanks),
        answer_json: { _v: "51.v1", blanks: { ...initialAnswers } },
        char_count: count51AnswerChars(initialAnswers),
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
      canonicalImportId,
      canonicalPayloadHash,
      canonicalQuestionId,
      draft,
      initialAnswers,
      problem.blanks,
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
      if (isShortAnswer51DraftJson(snapshot.draft.answer_json)) {
        setLastSavedSnapshot(
          serializeWritingAnswerSnapshot(snapshot.draft.answer_json.blanks),
        );
      }
      if (explicitSaveRef.current === null) {
        void logStudyEvent({
          eventType: "draft_autosaved",
          problemId: problem.id,
          payload: {
            question_no: 51,
            char_count:
              snapshot.draft.char_count ??
              count51AnswerChars(
                isShortAnswer51DraftJson(snapshot.draft.answer_json)
                  ? snapshot.draft.answer_json.blanks
                  : {},
              ),
          },
        });
      }
    },
    [problem.id],
  );
  const restorePrior = useCallback(
    (
      record: ClientRecoveryRecordV1,
      current: WritingResilienceSnapshot,
    ): WritingResilienceSnapshot => {
      const restoredAnswers = initialBlankAnswers(problem.blanks, {
        answer_json: record.answerJson,
        answer_text: record.answerText,
      });
      return {
        draft: {
          ...current.draft,
          answer_text: build51AnswerText(restoredAnswers, problem.blanks),
          answer_json: { _v: "51.v1", blanks: restoredAnswers },
          char_count: count51AnswerChars(restoredAnswers),
          autosave_status: "dirty",
        },
        draftId: record.draftId ?? current.draftId,
      };
    },
    [problem.blanks],
  );
  const resilience = useWritingResilience({
    debounceMs: DEBOUNCE_MS,
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
          fields: [
            {
              key: "role",
              label: tPage("hintRoleLabel"),
              value: blank.role?.trim(),
            },
            {
              key: "function",
              label: tPage("hintFunctionLabel"),
              value: blank.functionLabel?.trim(),
            },
            {
              key: "answerType",
              label: tPage("hintAnswerTypeLabel"),
              value: blank.answerType?.trim(),
            },
          ].filter(
            (field): field is { key: string; label: string; value: string } =>
              Boolean(field.value),
          ),
        }))
        .filter((item) => item.fields.length > 0),
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

  const previousStatusRef = useRef(status);
  useEffect(() => {
    if (status === "failed" && previousStatusRef.current !== "failed") {
      setWarningTrigger("save_failure");
    }
    previousStatusRef.current = status;
  }, [status]);

  function buildSnapshot(
    nextAnswers: Record<string, string>,
  ): WritingResilienceSnapshot {
    const nextText = build51AnswerText(nextAnswers, problem.blanks);
    const nextCharCount = count51AnswerChars(nextAnswers);
    return {
      draft: {
        ...initialSnapshot.draft,
        user_id: userId,
        problem_id: problem.id,
        question_no: 51,
        answer_text: nextText,
        answer_json: { _v: "51.v1", blanks: { ...nextAnswers } },
        char_count: nextCharCount,
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
    markInputActivity();
    const nextAnswers = { ...blankAnswers, [activeBlank.label]: next };
    setBlankAnswers(nextAnswers);
    setBlurNotice(null);
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
    if (!submittable || problem.submitBlockedReason || staleDraftVersion)
      return;
    setSubmitError(null);
    setConfirmOpen(true);
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
      if (!latest || !isShortAnswer51DraftJson(latest.draft.answer_json)) {
        throw new Error("The latest question 51 draft is unavailable.");
      }
    } catch {
      setConfirmOpen(false);
      setWarningTrigger("save_failure");
      return;
    } finally {
      explicitSaveRef.current = null;
    }

    const submittedAnswers = latest.draft.answer_json.blanks;
    const submittedAnswerJson: ShortAnswerQuestion51Json = {
      _v: "51.v1",
      blanks: submittedAnswers,
    };
    const submittedAnswerText = build51AnswerText(
      submittedAnswers,
      problem.blanks,
    );
    const submittedCharCount = count51AnswerChars(submittedAnswers);
    submit.mutate(
      {
        draft_id: savedDraft.id,
        problem_id: problem.id,
        question_no: 51,
        parent_submission_id: parentSubmissionId,
        answer_text: submittedAnswerText,
        answer_json: submittedAnswerJson,
        passage_context: problem.blankedPrompt || problem.prompt,
        char_count: submittedCharCount,
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
            payload: { question_no: 51, char_count: submittedCharCount },
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
            answerText: submittedAnswerText,
            charCount: submittedCharCount,
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
    void submitAnswer();
  }

  function onRetrySubmitFailure() {
    void submitAnswer({ clearFailure: false });
  }

  async function onChooseRecovery(choice: "prior" | "current") {
    setRecoveryChoice(choice);
    try {
      const selected = await resilience.chooseRecovery(choice);
      if (!selected || !isShortAnswer51DraftJson(selected.draft.answer_json))
        return;
      draftIdRef.current = selected.draftId;
      const selectedJson = selected.draft.answer_json;
      setBlankAnswers(
        Object.fromEntries(
          problem.blanks.map((blank) => [
            blank.label,
            selectedJson.blanks[blank.label] ?? "",
          ]),
        ),
      );
      setBlurNotice(null);
    } finally {
      setRecoveryChoice(null);
    }
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
      canSave={
        !submit.isPending &&
        charCount > 0 &&
        !staleDraftVersion &&
        resilience.state.hydrated &&
        !resilience.state.conflict
      }
      canSubmit={
        submittable &&
        !submit.isPending &&
        !Boolean(problem.submitBlockedReason) &&
        !staleDraftVersion &&
        resilience.state.hydrated &&
        !resilience.state.conflict
      }
      isSaving={status === "syncing"}
      isSubmitting={submit.isPending}
      problemBookmark={{ userId, problemId: problem.id }}
      onSave={() => void onManualSave()}
      onSubmit={onOpenSubmitConfirm}
      onRequestBack={() =>
        exitGuard.requestNavigation(returnHref, { mode: "replace" })
      }
    >
      <div className="writing-workspace writing-workspace--q51">
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
                        ? (blankHintText(activeBlank) ??
                          tPage("answerHintFallback"))
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
                  disabled={
                    submit.isPending ||
                    staleDraftVersion ||
                    !resilience.state.hydrated ||
                    Boolean(resilience.state.conflict)
                  }
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
                <Button size="small" type="link" onClick={onToggleAutosave}>
                  {autosaveEnabled
                    ? tEditor("autosaveOff")
                    : tEditor("autosaveOn")}
                </Button>
              </div>
            </section>
          </section>

          <aside className="writing-guide" aria-label={tPage("guideAria")}>
            <WritingGuideAccordion
              loadFailed={guideLoadFailed}
              loadFailedLabel={tGuide("loadFailedTag")}
              defaultActiveKeys={
                blankHints.length > 0
                  ? ["guide", "tips", "hints"]
                  : ["guide", "tips"]
              }
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
                ...(blankHints.length > 0
                  ? [
                      {
                        key: "hints",
                        disabledOnLoadFailed: true,
                        icon: <Eye aria-hidden size={18} />,
                        title: tPage("hintTitle"),
                        children: (
                          <div className="writing-guide-hints">
                            {blankHints.map(({ blank, index, fields }) => (
                              <div key={blank.key} className="app-card-compact">
                                <Text strong>{blankDisplay(blank, index)}</Text>
                                <Descriptions
                                  size="small"
                                  column={1}
                                  colon={false}
                                  items={fields.map((field) => ({
                                    key: field.key,
                                    label: field.label,
                                    children: field.value,
                                  }))}
                                />
                              </div>
                            ))}
                          </div>
                        ),
                      },
                    ]
                  : []),
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
          loading={submit.isPending || status === "syncing"}
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
          retrying={status === "syncing"}
          recoveryState={resilience.state.recoveryState}
          onKeep={() => {
            if (exitGuard.pendingNavigation) {
              exitGuard.cancelPendingNavigation();
              return;
            }
            setWarningTrigger(null);
          }}
          onRetry={() => {
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
        <WritingRecoveryConflictModal
          choosing={recoveryChoice}
          conflict={resilience.state.conflict}
          onChoose={onChooseRecovery}
        />
      </div>
    </WritingExamShell>
  );
}
