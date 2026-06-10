"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  Clock3,
  Eye,
  Info,
  Lightbulb,
  PenLine,
  RotateCcw,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { logStudyEvent } from "@/lib/events/study-events";
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
import type { AutosaveStatus, WritingDraftRow } from "@/lib/writing/types";
import { AutosaveBadge } from "./AutosaveBadge";
import {
  AutosaveWarningModal,
  type WarningTrigger,
} from "./AutosaveWarningModal";
import { QuestionPrompt } from "./QuestionPrompt";
import { ReferenceMaterials, type ProblemAsset } from "./ReferenceMaterials";
import { SubmissionConfirmModal } from "./SubmissionConfirmModal";

const { Text, Paragraph } = Typography;

type Q51Problem = Extract<NormalizedWritingProblem, { kind: "q51" }>;

type Props = {
  userId: string;
  problem: Q51Problem;
  draft: WritingDraftRow | null;
  assets?: ProblemAsset[];
};

const DEBOUNCE_MS = 2000;

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function blankDisplay(blank: NormalizedBlank, index: number) {
  return `${index + 1} ${blank.label}`;
}

export function ShortAnswerWriting51Workspace({
  userId,
  problem,
  draft,
  assets = [],
}: Props) {
  const tPage = useTranslations("writing.q51");
  const tEditor = useTranslations("writing.editor");
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
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeBlankIndex, setActiveBlankIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const upsert = useUpsertDraft();
  const submit = useSubmitWriting();
  const router = useRouter();

  const limit = getCharLimit(51);
  const charCount = useMemo(() => text.length, [text]);
  const submittable = isCountSubmittable(charCount, 51);
  const inRecommended = isCountInRecommendedRange(charCount, 51);
  const progressPercent = Math.min(
    100,
    Math.round((charCount / limit.hardMax) * 100),
  );
  const activeBlank = problem.blanks[activeBlankIndex] ?? problem.blanks[0];

  const expressionHints = [
    tPage("expressionHint0"),
    tPage("expressionHint1"),
    tPage("expressionHint2"),
    tPage("expressionHint3"),
    tPage("expressionHint4"),
  ];

  useEffect(() => {
    void logStudyEvent({
      eventType: "practice_started",
      problemId: problem.id,
      payload: { question_no: 51 },
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

  function persist(next: string, isManual: boolean) {
    setStatus("syncing");
    const seq = ++saveSeqRef.current;
    upsert.mutate(
      {
        user_id: userId,
        problem_id: problem.id,
        question_no: 51,
        answer_text: next,
        char_count: next.length,
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
              payload: { question_no: 51, char_count: next.length },
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
    setConfirmOpen(true);
  }

  function onConfirmSubmit() {
    setSubmitError(null);
    submit.mutate(
      {
        draft_id: draftId,
        problem_id: problem.id,
        question_no: 51,
        answer_text: text,
        char_count: charCount,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          void logStudyEvent({
            eventType: "submission_submitted",
            problemId: problem.id,
            submissionId: result.submissionId,
            payload: { question_no: 51, char_count: charCount },
          });
          router.push(`/writing/feedback/short/${result.submissionId}`);
        },
        onError: (e) => setSubmitError(e.message),
      },
    );
  }

  return (
    <div className="writing-workspace writing-workspace--q51">
      <header className="writing-command">
        <div className="writing-command__titles">
          <Space size={8} align="center" wrap>
            <h1 className="writing-command__title">{tPage("pageTitle")}</h1>
            <Tooltip title={tPage("titleHelp")}>
              <Info aria-hidden size={18} className="writing-command__info" />
            </Tooltip>
          </Space>
          <p className="writing-command__subtitle">{tPage("pageSubtitle")}</p>
        </div>
        <div className="writing-command__actions">
          <AutosaveBadge status={status} lastSavedAt={lastSavedAt} />
          <Tag icon={<Clock3 aria-hidden size={14} />}>
            {formatElapsed(elapsedSeconds)}
          </Tag>
          <Button
            icon={<PenLine aria-hidden size={16} />}
            onClick={onManualSave}
            loading={status === "syncing" && upsert.isPending}
            disabled={submit.isPending || text.length === 0}
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
          <Text>{tPage("stepRead")}</Text>
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

      <div className="writing-grid">
        <section className="writing-grid__main" aria-label={tPage("mainAria")}>
          <QuestionPrompt problem={problem} />
          <ReferenceMaterials
            assets={assets}
            materials={problem.referenceMaterials}
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
                    {activeBlank?.targetHint ??
                      activeBlank?.role ??
                      tPage("answerHintFallback")}
                  </Paragraph>
                </div>
                <Text type={inRecommended ? "success" : "secondary"}>
                  {tEditor("charCount", { charCount, hardMax: limit.hardMax })}{" "}
                  {tEditor("minOnly", { min: limit.hardMin })}
                  {inRecommended ? " ✓" : ""}
                </Text>
              </div>

              <Input.TextArea
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlurValidate}
                autoSize={{ minRows: 4 }}
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
            </div>

            <div className="writing-expression-row">
              <Space size={8} wrap>
                <Lightbulb aria-hidden size={18} />
                <Text strong>{tPage("expressionTitle")}</Text>
                {expressionHints.map((hint) => (
                  <Tag key={hint} className="writing-expression-chip">
                    {hint}
                  </Tag>
                ))}
                <Button size="small" type="link" onClick={onToggleAutosave}>
                  {autosaveEnabled
                    ? tEditor("autosaveOff")
                    : tEditor("autosaveOn")}
                </Button>
              </Space>
            </div>
          </section>
        </section>

        <aside className="writing-guide" aria-label={tPage("guideAria")}>
          <section className="writing-guide-card writing-guide-card--tutor">
            <div className="writing-guide-card__title">
              <Sparkles aria-hidden size={18} />
              <Text strong>{tPage("guideTitle")}</Text>
            </div>
            <p>{tPage("guideBody", { blank: activeBlank?.label ?? "ㄱ" })}</p>
          </section>

          <section className="writing-guide-card">
            <div className="writing-guide-card__title">
              <PenLine aria-hidden size={18} />
              <Text strong>{tPage("tipsTitle")}</Text>
            </div>
            <ul className="writing-guide-list">
              <li>{tPage("tip0")}</li>
              <li>{tPage("tip1")}</li>
            </ul>
          </section>

          <section className="writing-guide-card">
            <div className="writing-guide-card__title">
              <Eye aria-hidden size={18} />
              <Text strong>{tPage("hintTitle")}</Text>
            </div>
            <div className="writing-guide-hints">
              {problem.blanks.map((blank, index) => (
                <div key={blank.key} className="app-card-compact">
                  <Text strong>{blankDisplay(blank, index)}</Text>
                  <Text type="secondary">
                    {blank.targetHint ??
                      blank.role ??
                      tPage("answerHintFallback")}
                  </Text>
                </div>
              ))}
            </div>
          </section>

          <Button
            block
            icon={<RotateCcw aria-hidden size={16} />}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            {tPage("reviewPrompt")}
          </Button>
        </aside>
      </div>

      <SubmissionConfirmModal
        open={confirmOpen}
        charCount={charCount}
        minChars={limit.hardMin}
        questionNo={51}
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
          persist(text, false);
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
