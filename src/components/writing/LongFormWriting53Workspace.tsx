"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Input, Progress, Segmented, Tabs, Typography } from "antd";
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
  combine53Sections,
  isLongFormDraftJson,
  type AutosaveStatus,
  type LongFormDraftJson,
  type WritingDraftRow,
  type WritingRetrySeed,
} from "@/lib/writing/types";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import { ConditionsPanel } from "./ConditionsPanel";
import {
  ManuscriptPreview,
  type ManuscriptSectionKey,
} from "./ManuscriptPreview";
import { QuestionPrompt } from "./QuestionPrompt";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";
import { SubmissionFailedModal } from "./SubmissionFailedModal";
import { StaleDraftVersionAlert } from "./StaleDraftVersionAlert";
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { Writing53MaterialCards } from "./Writing53MaterialCards";
import { WritingGuideAccordion } from "./WritingGuideAccordion";
import { WritingExamShell } from "./WritingExamShell";
import { WritingRecoveryConflictModal } from "./WritingRecoveryConflictModal";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

const { Text, Paragraph } = Typography;

type Q53Problem = Extract<NormalizedWritingProblem, { kind: "q53" }>;

type Props = {
  userId: string;
  problem: Q53Problem;
  draft: WritingDraftRow | null;
  retrySeed?: WritingRetrySeed | null;
  parentSubmissionId?: string | null;
  returnHref: string;
};

type Question53State = {
  intro: string;
  body: string;
  conclusion: string;
};

type SectionKey = keyof Question53State;
type ComposerMode = "write" | "manuscript";
type LongFormAnswerSource = {
  answer_json?: unknown;
  answer_text?: string | null;
};

const DEBOUNCE_MS = 2000;
const MANUSCRIPT_SECTION_ORDER: ManuscriptSectionKey[] = [
  "intro",
  "body",
  "conclusion",
];

function readInitial53(draft: LongFormAnswerSource | null): Question53State {
  if (
    draft?.answer_json &&
    isLongFormDraftJson(draft.answer_json) &&
    draft.answer_json._v === "53.v1"
  ) {
    return { ...draft.answer_json.sections };
  }
  return { intro: "", body: draft?.answer_text ?? "", conclusion: "" };
}

function build53Json(state: Question53State): LongFormDraftJson {
  return { _v: "53.v1", sections: state };
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

function create53Snapshot({
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
  state: Question53State;
  userId: string;
}): WritingResilienceSnapshot {
  const answerText = combine53Sections(state);
  return {
    draft: {
      user_id: userId,
      problem_id: problemId,
      question_no: 53,
      answer_text: answerText,
      answer_json: cloneLongFormDraftJson(build53Json(state)),
      char_count: answerText.length,
      autosave_status: autosaveStatus,
      last_saved_at: lastSavedAt,
      canonical_question_id: canonicalQuestionId,
      canonical_import_id: canonicalImportId ? Number(canonicalImportId) : null,
      canonical_payload_hash: canonicalPayloadHash,
    },
    draftId,
  };
}

function build53ManuscriptPreview(state: Question53State): {
  text: string;
  sections: Array<ManuscriptSectionKey | null>;
} {
  const chars: string[] = [];
  const sections: Array<ManuscriptSectionKey | null> = [];

  for (const key of MANUSCRIPT_SECTION_ORDER) {
    const sectionChars = Array.from(state[key].trim());
    if (sectionChars.length === 0) continue;

    if (chars.length > 0) {
      chars.push("\n", "\n");
      sections.push(null, null);
    }

    for (const char of sectionChars) {
      chars.push(char);
      sections.push(key);
    }
  }

  return { text: chars.join(""), sections };
}

export function LongFormWriting53Workspace({
  userId,
  problem,
  draft,
  retrySeed = null,
  parentSubmissionId = null,
  returnHref,
}: Props) {
  const tPage = useTranslations("writing.q53");
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
    () => readInitial53(answerSource),
    [answerSource],
  );
  const [state, setState] = useState<Question53State>(() => initialState);
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
  const initialSnapshot = useMemo(
    () =>
      create53Snapshot({
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
  const [activeSection, setActiveSection] = useState<SectionKey>("intro");
  const serverSaveKindRef = useRef<"auto" | "manual">("auto");
  const upsert = useUpsertDraft();

  const limit = getCharLimit(53);
  const combinedText = useMemo(() => combine53Sections(state), [state]);
  const manuscriptPreview = useMemo(
    () => build53ManuscriptPreview(state),
    [state],
  );
  const manuscriptSectionLabels: Record<ManuscriptSectionKey, string> = {
    intro: tEditor("tab53Intro"),
    body: tEditor("tab53Body"),
    conclusion: tEditor("tab53Conclusion"),
  };
  const charCount = combinedText.length;
  const submittable = isCountSubmittable(charCount, 53);
  const inRecommended = isCountInRecommendedRange(charCount, 53);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const currentAnswerSnapshot = useMemo(
    () => serializeWritingAnswerSnapshot(build53Json(state)),
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
            question_no: 53,
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
        record.answerJson._v !== "53.v1"
      ) {
        return undefined;
      }
      const restoredState = { ...record.answerJson.sections };
      const answerText = combine53Sections(restoredState);
      return {
        draft: {
          ...current.draft,
          answer_text: answerText,
          answer_json: cloneLongFormDraftJson(build53Json(restoredState)),
          char_count: answerText.length,
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
  const guideItems =
    problem.guideCards.length > 0
      ? problem.guideCards
      : [tPage("guideBody"), tPage("guideTip0"), tPage("guideTip1")];

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId: problem.id,
      payload: { question_no: 53 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createSnapshot(nextState: Question53State) {
    return create53Snapshot({
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

  function onSectionChange(key: SectionKey, next: string) {
    markInputActivity();
    const nextState: Question53State = { ...state, [key]: next };
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
    if (!submittable || problem.submitBlockedReason || staleDraftVersion)
      return;
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
          question_no: 53,
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
              payload: { question_no: 53, char_count: preparedCharCount },
            });
            void recordWritingSubmissionMetrics({
              submissionId: result.submissionId,
              problemId: problem.id,
              questionNo: 53,
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
      setState(readInitial53(selected.draft));
      setDraftId(selected.draftId);
      setBlurNotice(null);
    } finally {
      setChoosingRecovery(null);
    }
  }

  if (submittedAnalysis) {
    return <SubmittedAnalysisPanel state={submittedAnalysis} />;
  }

  function sectionEditor(
    key: SectionKey,
    label: string,
    placeholder: string,
    minRows = 5,
  ) {
    return (
      <div>
        <Input.TextArea
          aria-label={label}
          value={state[key]}
          onChange={(e) => onSectionChange(key, e.target.value)}
          onBlur={validateLength}
          autoSize={{ minRows }}
          placeholder={placeholder}
          disabled={
            submissionPending ||
            staleDraftVersion ||
            Boolean(resilience.state.conflict)
          }
        />
      </div>
    );
  }

  function sectionTabs(showEditors: boolean) {
    return (
      <Tabs
        activeKey={activeSection}
        className={
          showEditors
            ? "writing-section-tabs"
            : "writing-section-tabs writing-section-tabs--menu-only"
        }
        onChange={(key) => setActiveSection(key as SectionKey)}
        items={[
          {
            key: "intro",
            label: tEditor("tab53Intro"),
            children: showEditors
              ? sectionEditor(
                  "intro",
                  tEditor("section53IntroLabel"),
                  tEditor("section53IntroPlaceholder"),
                )
              : null,
          },
          {
            key: "body",
            label: tEditor("tab53Body"),
            children: showEditors
              ? sectionEditor(
                  "body",
                  tEditor("section53BodyLabel"),
                  tEditor("section53BodyPlaceholder"),
                  7,
                )
              : null,
          },
          {
            key: "conclusion",
            label: tEditor("tab53Conclusion"),
            children: showEditors
              ? sectionEditor(
                  "conclusion",
                  tEditor("section53ConclusionLabel"),
                  tEditor("section53ConclusionPlaceholder"),
                )
              : null,
          },
        ]}
      />
    );
  }

  const charCountUI = (
    <Text type={inRecommended ? "success" : "secondary"}>
      {tEditor("charCount", { charCount, hardMax: limit.hardMax })}{" "}
      {tEditor("recommendedRange", {
        min: limit.recommendedMin,
        max: limit.recommendedMax,
      })}
      {inRecommended ? " ✓" : ""}
    </Text>
  );

  const composerProgress = (
    <Progress
      percent={progressPercent}
      showInfo={false}
      size="small"
      status={inRecommended ? "success" : "active"}
    />
  );

  return (
    <WritingExamShell
      title={tPage("pageTitle")}
      subtitle={tPage("pageSubtitle")}
      progressPercent={progressPercent}
      elapsedSeconds={elapsedSeconds}
      autosaveStatus={status}
      lastSavedAt={lastSavedAt}
      canSave={
        !submissionPending &&
        combinedText.length > 0 &&
        !staleDraftVersion &&
        !resilience.state.conflict
      }
      canSubmit={
        submittable &&
        Boolean(draftId) &&
        !submissionPending &&
        !Boolean(problem.submitBlockedReason) &&
        !staleDraftVersion &&
        !resilience.state.conflict
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
      <div className="writing-workspace writing-workspace--q53">
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

        <div className="writing-grid writing-grid--longform">
          <section
            className="writing-grid__support"
            aria-label={tPage("sourceAria")}
          >
            <QuestionPrompt problem={problem} />
            <div className="writing-materials-anchor">
              <Writing53MaterialCards cards={problem.materialCards} />
            </div>
            <ConditionsPanel
              questionNo={53}
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
                    <div className="writing-guide-copy">
                      <ul className="writing-guide-list">
                        {guideItems.map((item, index) => (
                          <li key={`${index}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
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
                  <Paragraph
                    type="secondary"
                    className="writing-answer-card__hint"
                  >
                    {tPage("editorHint")}
                  </Paragraph>
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
                          <span data-testid="q53-composer-mode-write">
                            {tPage("composerModeWrite")}
                          </span>
                        ),
                        value: "write",
                      },
                      {
                        label: (
                          <span data-testid="q53-composer-mode-manuscript">
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
                  data-testid="q53-composer-write-panel"
                >
                  {composerProgress}

                  {sectionTabs(true)}

                  {blurNotice ? (
                    <Text type="danger" className="writing-answer-card__notice">
                      {blurNotice}
                    </Text>
                  ) : null}
                </div>
              ) : (
                <div
                  className="writing-composer-panel writing-composer-panel--manuscript"
                  data-testid="q53-composer-manuscript-panel"
                >
                  {composerProgress}
                  {sectionTabs(false)}
                  <ManuscriptPreview
                    text={manuscriptPreview.text}
                    cellSections={manuscriptPreview.sections}
                    activeSection={activeSection}
                    sectionLabels={manuscriptSectionLabels}
                    showHeader={false}
                  />
                </div>
              )}
            </AppCard>
          </section>
        </div>

        <SubmissionConfirmModal
          open={confirmOpen}
          charCount={charCount}
          minChars={limit.hardMin}
          questionNo={53}
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
