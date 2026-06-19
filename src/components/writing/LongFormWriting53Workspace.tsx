"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Input, Progress, Segmented, Tabs, Typography } from "antd";
import { Sparkles } from "lucide-react";
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
  combine53Sections,
  isLongFormDraftJson,
  type AutosaveStatus,
  type LongFormDraftJson,
  type WritingDraftRow,
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
import {
  SubmittedAnalysisPanel,
  type SubmittedAnalysisState,
} from "./SubmittedAnalysisPanel";
import { Writing53MaterialCards } from "./Writing53MaterialCards";
import { WritingGuideAccordion } from "./WritingGuideAccordion";
import { WritingExamShell } from "./WritingExamShell";
import { serializeWritingAnswerSnapshot } from "./writingAnswerSnapshot";

const { Text, Paragraph } = Typography;

type Q53Problem = Extract<NormalizedWritingProblem, { kind: "q53" }>;

type Props = {
  userId: string;
  problem: Q53Problem;
  draft: WritingDraftRow | null;
};

type Question53State = {
  intro: string;
  body: string;
  conclusion: string;
};

type SectionKey = keyof Question53State;
type ComposerMode = "write" | "manuscript";

const DEBOUNCE_MS = 2000;
const MANUSCRIPT_SECTION_ORDER: ManuscriptSectionKey[] = [
  "intro",
  "body",
  "conclusion",
];

function readInitial53(draft: WritingDraftRow | null): Question53State {
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

export function LongFormWriting53Workspace({ userId, problem, draft }: Props) {
  const tPage = useTranslations("writing.q53");
  const tEditor = useTranslations("writing.editor");
  const tGuide = useTranslations("writing.guide");
  const [state, setState] = useState<Question53State>(() =>
    readInitial53(draft),
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
  const [activeSection, setActiveSection] = useState<SectionKey>("intro");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();

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
    nextJson: LongFormDraftJson,
    nextText: string,
    isManual: boolean,
  ) {
    const nextSnapshot = serializeWritingAnswerSnapshot(nextJson);
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problem.id,
        question_no: 53,
        answer_text: nextText,
        answer_json: JSON.parse(JSON.stringify(nextJson)),
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
              payload: { question_no: 53, char_count: nextText.length },
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

  function scheduleSave(nextState: Question53State) {
    const nextText = combine53Sections(nextState);
    if (status !== "syncing") setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => persist(build53Json(nextState), nextText, false),
      DEBOUNCE_MS,
    );
  }

  function onSectionChange(key: SectionKey, next: string) {
    const nextState: Question53State = { ...state, [key]: next };
    setState(nextState);
    setBlurNotice(null);
    scheduleSave(nextState);
  }

  function onManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(build53Json(state), combinedText, true);
  }

  function onOpenSubmitConfirm() {
    validateLength();
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
        question_no: 53,
        answer_text: combinedText,
        answer_json: JSON.parse(JSON.stringify(build53Json(state))),
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
            payload: { question_no: 53, char_count: charCount },
          });
          setSubmittedAnalysis({
            submissionId: result.submissionId,
            questionNo: result.questionNo,
            answerText: combinedText,
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
          disabled={submit.isPending}
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
      canSave={!submit.isPending && combinedText.length > 0}
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
      <div className="writing-workspace writing-workspace--q53">
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
              persist(build53Json(state), combinedText, true);
              return;
            }
            setWarningTrigger(null);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            persist(build53Json(state), combinedText, false);
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
