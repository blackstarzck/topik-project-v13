"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Descriptions, Input, Progress, Typography } from "antd";
import { Eye, PenLine, Sparkles } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";

import { logStudyEvent } from "@/lib/events/study-events";
import { useWritingTimeMetrics } from "@/hooks/useWritingTimeMetrics";
import { recordWritingSubmissionMetrics } from "@/lib/writing/metrics";
import {
  getCharLimit,
  isCountInRecommendedRange,
  isCountSubmittable,
} from "@/lib/writing/constants";
import type {
  NormalizedBlank,
  NormalizedWritingProblem,
} from "@/lib/writing/problem-normalizer";
import type { WritingDraftRow, WritingRetrySeed } from "@/lib/writing/types";
import { AutosaveWarningModal } from "./AutosaveWarningModal";
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
import { useShortAnswerWritingWorkspace } from "./useShortAnswerWritingWorkspace";
import styles from "./ShortAnswerWritingWorkspace.module.css";

const { Text } = Typography;

type Q52Problem = Extract<NormalizedWritingProblem, { kind: "q52" }>;

type Props = {
  userId: string;
  problem: Q52Problem;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
  returnHref: string;
};

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
  retrySeed = null,
  parentSubmissionId = null,
  returnHref,
}: Props) {
  const tPage = useTranslations("writing.q52");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blurNotice, setBlurNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAnalysis, setSubmittedAnalysis] =
    useState<SubmittedAnalysisState | null>(null);
  const { elapsedSeconds, markInputActivity, getTimeMetricsSnapshot } =
    useWritingTimeMetrics();
  const workspace = useShortAnswerWritingWorkspace({
    draft,
    onAnswerActivity: markInputActivity,
    onAnswersSelected: () => setBlurNotice(null),
    problem,
    retrySeed,
    returnHref,
    userId,
  });
  const {
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
  } = workspace;

  const limit = getCharLimit(52);
  const submittable = isCountSubmittable(charCount, 52);
  const inRecommended = isCountInRecommendedRange(charCount, 52);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const guideLoadFailed =
    problem.submitBlockedReason === "problem_data_incomplete";

  const guideMessages = useMemo(
    () => uniqueNonEmpty(problem.rubric.conditions),
    [problem.rubric.conditions],
  );
  const writingTips = useMemo(
    () =>
      uniqueNonEmpty([
        ...problem.validationMessages,
        ...problem.rubric.criteria,
      ]),
    [problem.validationMessages, problem.rubric.criteria],
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
    const prepared = await prepareSubmission();
    if (!prepared) {
      setConfirmOpen(false);
      return;
    }

    const submittedAnswerJson = prepared.payload.answerJson;
    const submittedAnswerText = prepared.payload.answerText;
    const submittedCharCount = prepared.payload.charCount;
    submit.mutate(
      {
        draft_id: prepared.savedDraft.id,
        problem_id: problem.id,
        question_no: 52,
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
            payload: { question_no: 52, char_count: submittedCharCount },
          });
          void recordWritingSubmissionMetrics({
            submissionId: result.submissionId,
            problemId: problem.id,
            questionNo: 52,
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
      <div className="writing-workspace writing-workspace--q52">
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
                  <Text
                    type={inRecommended ? "success" : "secondary"}
                    className="self-end text-right"
                  >
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
                      <Text type="secondary">{tPage("conditionFallback")}</Text>
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
                      <Text type="secondary">{tPage("guideFallback")}</Text>
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
                          <div
                            className={[
                              "writing-guide-hints",
                              styles.guideHints,
                            ].join(" ")}
                          >
                            {blankHints.map(({ blank, index, fields }) => (
                              <div
                                key={blank.key}
                                className={[
                                  "app-card-compact",
                                  styles.guideHintCard,
                                ].join(" ")}
                              >
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
          questionNo={52}
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
          onKeep={onKeepWarning}
          onRetry={onRetryWarning}
          onProceed={onProceedWarning}
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
