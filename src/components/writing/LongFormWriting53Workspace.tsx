"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Progress,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
import {
  Clock3,
  Info,
  Lightbulb,
  PenLine,
  RotateCcw,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AppCard } from "@/components/shared/AppCard";
import { logStudyEvent } from "@/lib/events/study-events";
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
import { AutosaveBadge } from "./AutosaveBadge";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import { ConditionsPanel } from "./ConditionsPanel";
import { ManuscriptPreview } from "./ManuscriptPreview";
import { QuestionPrompt } from "./QuestionPrompt";
import { ReferenceMaterials, type ProblemAsset } from "./ReferenceMaterials";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";

const { Text, Paragraph } = Typography;

type Q53Problem = Extract<NormalizedWritingProblem, { kind: "q53" }>;

type Props = {
  userId: string;
  problem: Q53Problem;
  draft: WritingDraftRow | null;
  assets?: ProblemAsset[];
};

type Question53State = {
  intro: string;
  body: string;
  conclusion: string;
};

type SectionKey = keyof Question53State;

const DEBOUNCE_MS = 2000;

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

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

function paragraphCount(state: Question53State): number {
  return Object.values(state).filter((value) => value.trim().length > 0).length;
}

export function LongFormWriting53Workspace({
  userId,
  problem,
  draft,
  assets = [],
}: Props) {
  const tPage = useTranslations("writing.q53");
  const tEditor = useTranslations("writing.editor");
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
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();
  const router = useRouter();

  const limit = getCharLimit(53);
  const combinedText = useMemo(() => combine53Sections(state), [state]);
  const charCount = combinedText.length;
  const submittable = isCountSubmittable(charCount, 53);
  const inRecommended = isCountInRecommendedRange(charCount, 53);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const filledParagraphs = paragraphCount(state);

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
    if (!autosaveEnabled) {
      setStatus("dirty");
      return;
    }
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

  function onToggleAutosave() {
    if (autosaveEnabled) {
      setWarningTrigger("disable_attempt");
    } else {
      setAutosaveEnabled(true);
    }
  }

  function onOpenSubmitConfirm() {
    validateLength();
    if (!submittable || problem.submitBlockedReason) return;
    setConfirmOpen(true);
  }

  function onConfirmSubmit() {
    setSubmitError(null);
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
          void logStudyEvent({
            eventType: "submission_submitted",
            problemId: problem.id,
            submissionId: result.submissionId,
            payload: { question_no: 53, char_count: charCount },
          });
          router.push(`/writing/feedback/long/${result.submissionId}`);
        },
        onError: (e) => setSubmitError(e.message),
      },
    );
  }

  function sectionEditor(
    key: SectionKey,
    label: string,
    placeholder: string,
    minRows = 5,
  ) {
    return (
      <div>
        <Text strong>{label}</Text>
        <Input.TextArea
          aria-label={label}
          value={state[key]}
          onChange={(e) => onSectionChange(key, e.target.value)}
          onBlur={validateLength}
          autoSize={{ minRows }}
          placeholder={placeholder}
          disabled={submit.isPending}
          className="mt-2"
        />
      </div>
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

  return (
    <div className="writing-workspace writing-workspace--q53">
      <header className="writing-command">
        <div className="writing-command__titles">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="writing-command__title">{tPage("pageTitle")}</h1>
            <Tooltip title={tPage("titleHelp")}>
              <Info aria-hidden size={18} className="writing-command__info" />
            </Tooltip>
          </div>
          <p className="writing-command__subtitle">{tPage("pageSubtitle")}</p>
        </div>
        <div className="writing-command__actions">
          <AutosaveBadge status={status} lastSavedAt={lastSavedAt} />
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text">
            <Clock3 aria-hidden size={14} />
            {formatElapsed(elapsedSeconds)}
          </span>
          <Button
            icon={<PenLine aria-hidden size={16} />}
            onClick={onManualSave}
            loading={status === "syncing" && upsert.isPending}
            disabled={submit.isPending || combinedText.length === 0}
          >
            {tEditor("saveDraft")}
          </Button>
          <Button
            type="primary"
            icon={<SendHorizontal aria-hidden size={16} />}
            onClick={onOpenSubmitConfirm}
            disabled={
              !submittable ||
              submit.isPending ||
              Boolean(problem.submitBlockedReason)
            }
          >
            {tEditor("submit")}
          </Button>
        </div>
      </header>

      <section className="writing-stepper" aria-label={tPage("stepperLabel")}>
        <div className="writing-step writing-step--done">
          <span>1</span>
          <Text>{tPage("stepAnalyze")}</Text>
        </div>
        <div className="writing-step writing-step--active">
          <span>2</span>
          <Text strong>{tPage("stepWrite")}</Text>
        </div>
        <div className="writing-step">
          <span>3</span>
          <Text type="secondary">{tPage("stepSubmit")}</Text>
        </div>
      </section>

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
          <ReferenceMaterials
            assets={assets}
            materials={problem.referenceMaterials}
          />
          <ConditionsPanel
            questionNo={53}
            rubric={problem.rubric}
            loadFailed={problem.submitBlockedReason === "problem_data_incomplete"}
          />
          <section className="writing-guide-card writing-guide-card--tutor">
            <div className="writing-guide-card__title">
              <Sparkles aria-hidden size={18} />
              <Text strong>{tPage("guideTitle")}</Text>
            </div>
            <p>{tPage("guideBody")}</p>
            <ul className="writing-guide-list">
              <li>{tPage("guideTip0")}</li>
              <li>{tPage("guideTip1")}</li>
            </ul>
          </section>
        </section>

        <section
          className="writing-grid__composer"
          aria-label={tPage("composerAria")}
        >
          <AppCard>
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
              {charCountUI}
            </div>

            <Progress
              percent={progressPercent}
              showInfo={false}
              size="small"
              status={inRecommended ? "success" : "active"}
            />

            <Tabs
              items={[
                {
                  key: "intro",
                  label: tEditor("tab53Intro"),
                  children: sectionEditor(
                    "intro",
                    tEditor("section53IntroLabel"),
                    tEditor("section53IntroPlaceholder"),
                  ),
                },
                {
                  key: "body",
                  label: tEditor("tab53Body"),
                  children: sectionEditor(
                    "body",
                    tEditor("section53BodyLabel"),
                    tEditor("section53BodyPlaceholder"),
                    7,
                  ),
                },
                {
                  key: "conclusion",
                  label: tEditor("tab53Conclusion"),
                  children: sectionEditor(
                    "conclusion",
                    tEditor("section53ConclusionLabel"),
                    tEditor("section53ConclusionPlaceholder"),
                  ),
                },
              ]}
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

            <div className="writing-editor-toolbar">
              <div className="flex flex-wrap items-center gap-2">
                <Lightbulb aria-hidden size={18} />
                <Text strong>{tPage("statusTitle")}</Text>
                <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold text-text-secondary">
                  {tPage("paragraphCount", { count: filledParagraphs })}
                </span>
                <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold text-text-secondary">
                  {tPage("targetRange")}
                </span>
                <Button size="small" type="link" onClick={onToggleAutosave}>
                  {autosaveEnabled
                    ? tEditor("autosaveOff")
                    : tEditor("autosaveOn")}
                </Button>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <ManuscriptPreview text={combinedText} />
          </AppCard>

          <Button
            block
            icon={<RotateCcw aria-hidden size={16} />}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            {tPage("reviewMaterials")}
          </Button>
        </section>
      </div>

      <SubmissionConfirmModal
        open={confirmOpen}
        charCount={charCount}
        minChars={limit.hardMin}
        questionNo={53}
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
        onRetry={() => {
          setWarningTrigger(null);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          persist(build53Json(state), combinedText, false);
        }}
        onProceed={() => {
          if (warningTrigger === "disable_attempt") {
            setAutosaveEnabled(false);
          }
          setWarningTrigger(null);
        }}
      />
    </div>
  );
}
