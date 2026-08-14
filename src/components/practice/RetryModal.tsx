"use client";

import { Alert, Button, Descriptions, Radio, Typography } from "antd";
import type { DescriptionsProps } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppModal } from "@/components/shared/AppModal";
import { writingProblemHref } from "@/lib/writing/routes";
import type { FeedbackStatus } from "@/lib/writing/types";

const { Paragraph, Text } = Typography;

/** 재풀이 모드 — description.md §3 (새 답안 / 이전 답안 기반 / 힌트 포함). */
type RetryMode = "fresh" | "resume" | "hint";

/**
 * C-03 다시 풀기 모달.
 *
 * Routes:
 * - 다시 풀기 → `/writing/[questionNo]?problem=[problemId]&fresh=1`
 * - 결과 보기 (submission 있을 때) → `/writing/feedback/{short|long}/[submissionId]`
 *   submissionId 는 모달 열림 시 problem_attempts/writing_submissions 에서 lazy 조회.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  problemId: string;
  /** C-03 §2 — 문제 제목 요약. */
  problemTitle?: string;
  /** 라우트 분기 + §2 유형 표시를 위해 question_no 필요. */
  questionNo: number | null;
  /** C-03 §2 — 이전 풀이 상태 요약: 시도 횟수. */
  attemptCount?: number;
  /** C-03 §2 — 마지막 시도 시각(ISO). */
  lastAttemptAt?: string | null;
  /** True when there is a completed submission to view. */
  hasSubmission: boolean;
  /** True when there is an in-progress attempt but no submission yet. */
  hasAttempt: boolean;
  /**
   * Submission id for the "결과 보기" deep link when already known by the caller.
   * When omitted (e.g. RPC list path), the modal resolves the latest submission
   * id lazily from writing_submissions on click.
   */
  submissionId?: string;
  feedbackStatus?: FeedbackStatus | null;
  returnTo?: string;
  /**
   * C-03 §2 예외 — 문제 만료 시 시작 대신 만료 안내 + 닫기만 제공.
   * 만료 정책은 아직 미정이므로 기본 false; 상위에서 확정된 정책값을
   * 주입하기 전까지는 사용자에게 만료 차단 UX를 노출하지 않는다.
   */
  expired?: boolean;
};

function feedbackPathFor(
  questionNo: number | null,
  submissionId: string,
): string {
  if (questionNo === 51 || questionNo === 52) {
    return `/writing/feedback/short/${submissionId}`;
  }
  return `/writing/feedback/long/${submissionId}`;
}

/**
 * i18n: returns a structured descriptor (resolved via `t()` in the component)
 * instead of a localized string. `absolute` keeps locale-specific date
 * formatting in the helper for the >=7 days branch.
 */
type RelativeDay =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "daysAgo"; days: number }
  | { kind: "absolute"; text: string };

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const modalClassNames = {
  header: "!mb-0 !px-0 !pb-0",
  body: "!px-0 !pt-5",
  title: "!text-[22px] !font-bold !leading-7 !text-text",
};

function relativeDay(iso: string | null | undefined): RelativeDay | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (days <= 0) return { kind: "today" };
  if (days === 1) return { kind: "yesterday" };
  if (days < 7) return { kind: "daysAgo", days };
  return { kind: "absolute", text: new Date(iso).toLocaleDateString("ko-KR") };
}

export function RetryModal({
  open,
  onClose,
  problemId,
  problemTitle,
  questionNo,
  attemptCount = 0,
  lastAttemptAt,
  hasSubmission,
  hasAttempt,
  submissionId,
  feedbackStatus,
  returnTo,
  expired = false,
}: Props) {
  const t = useTranslations("practice.retry");
  const tCommon = useTranslations("practice.common");
  const tActions = useTranslations("common");
  const router = useRouter();
  const [mode, setMode] = useState<RetryMode>(hasAttempt ? "resume" : "fresh");
  const [starting, setStarting] = useState(false);
  // i18n: store an error KEY (not a localized string) so the message resolves
  // through the practice.retry namespace at render time.
  const [startErrorKey, setStartErrorKey] = useState<
    "startMissingType" | "startOpenFailed" | null
  >(null);

  useEffect(() => {
    if (!open) return;

    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(
        ".app-modal [role='dialog']",
      );
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!(active instanceof HTMLElement) || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTabKey, true);
    return () => document.removeEventListener("keydown", handleTabKey, true);
  }, [open]);

  function handleStart() {
    // §4 — 시작 클릭 후 중복 실행 차단.
    if (starting) return;
    setStartErrorKey(null);
    if (questionNo == null) {
      setStartErrorKey("startMissingType");
      return;
    }
    setStarting(true);
    try {
      const canUseHintMode = false;
      router.push(
        writingProblemHref({
          questionNo,
          problemId,
          fresh: mode === "fresh",
          hint: canUseHintMode && mode === "hint",
          returnTo,
        }) as never,
      );
    } catch {
      setStarting(false);
      setStartErrorKey("startOpenFailed");
    }
  }

  function handleViewResult() {
    onClose();
    // caller 가 submissionId 를 주면 피드백으로 deep-link, 없으면 목록 폴백.
    if (submissionId) {
      router.push(feedbackPathFor(questionNo, submissionId) as never);
      return;
    }
    router.push("/practice/problems" as never);
  }

  const canViewResult = hasSubmission || Boolean(submissionId);
  const rel = relativeDay(lastAttemptAt);
  const lastLabel = rel
    ? rel.kind === "today"
      ? tCommon("dayToday")
      : rel.kind === "yesterday"
        ? tCommon("dayYesterday")
        : rel.kind === "daysAgo"
          ? tCommon("daysAgo", { days: rel.days })
          : rel.text
    : null;

  // §2 — 이전 풀이 상태 요약 라벨.
  const analysisFailed = feedbackStatus === "failed";
  const analysisInProgress =
    feedbackStatus === "pending" || feedbackStatus === "analyzing";
  const resultActionLabel = analysisFailed
    ? t("viewFailedStatus")
    : t("viewResult");
  const statusLabel =
    analysisFailed && hasSubmission
      ? t("statusSubmittedRecentFailure")
      : analysisFailed
        ? t("statusFailed")
        : analysisInProgress
          ? t("statusAnalyzing")
          : hasSubmission
            ? t("statusSubmitted")
            : hasAttempt
              ? t("statusDrafting")
              : t("statusNone");

  const previousStatusMeta = [
    statusLabel,
    attemptCount > 0 ? tCommon("attemptCount", { count: attemptCount }) : null,
    lastLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const compactSummaryMeta = [previousStatusMeta].filter(Boolean).join(" · ");

  const questionNoLabel = questionNo
    ? tCommon("questionNo", { no: questionNo })
    : "-";

  const summaryItems: DescriptionsProps["items"] = [
    {
      key: "problem",
      label: t("summaryProblem"),
      children: (
        <Text strong className="retry-modal-summary__value">
          {(problemTitle ?? t("summaryFallbackProblem")).slice(0, 28)}
        </Text>
      ),
    },
    {
      key: "question",
      label: t("summaryType"),
      children: (
        <Text strong className="retry-modal-summary__value">
          {questionNoLabel}
        </Text>
      ),
    },
    {
      key: "status",
      label: t("summaryPreviousStatus"),
      children: (
        <Text className="retry-modal-summary__value">
          {compactSummaryMeta || "-"}
        </Text>
      ),
    },
  ];

  // §1 예외 — 위험 상태(시작 처리 중)에서는 배경 클릭/ESC 닫기 비활성.
  const risky = starting;

  const summary = (
    <Descriptions
      data-testid="retry-modal-compact-summary"
      className="retry-modal-summary"
      bordered
      colon={false}
      column={1}
      items={summaryItems}
      size="small"
    />
  );

  // §2 예외 — 만료된 문제: 시작/모드 선택 숨기고 만료 안내 + 닫기만.
  if (expired) {
    return (
      <AppModal
        open={open}
        onCancel={onClose}
        title={t("expiredTitle")}
        footer={null}
        width={532}
        className="retry-modal"
        classNames={modalClassNames}
        mask={{ closable: true }}
        destroyOnHidden
      >
        {summary}
        {canViewResult ? (
          <Button
            className="mb-6 !h-auto !p-0"
            type="link"
            size="small"
            onClick={handleViewResult}
            disabled={risky}
          >
            {resultActionLabel}
          </Button>
        ) : null}
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          title={t("expiredMessage")}
          description={t("expiredDescription")}
        />
        <Button block onClick={onClose}>
          {t("close")}
        </Button>
      </AppModal>
    );
  }

  return (
    <AppModal
      open={open}
      onCancel={risky ? undefined : onClose}
      title={t("title")}
      footer={null}
      width={532}
      className="retry-modal"
      classNames={modalClassNames}
      mask={{ closable: !risky }}
      keyboard={!risky}
      destroyOnHidden
    >
      {summary}
      {canViewResult ? (
        <Button
          className="mb-6 !h-auto !p-0"
          type="link"
          size="small"
          onClick={handleViewResult}
          disabled={risky}
        >
          {resultActionLabel}
        </Button>
      ) : null}

      <Paragraph className="!mb-4 !text-base !text-text">
        {t("intro")}
      </Paragraph>

      {/* §3 — 재풀이 모드 선택 (기본 선택 1개 항상 존재). */}
      <Radio.Group
        className="w-full"
        value={mode}
        onChange={(e) => setMode(e.target.value as RetryMode)}
      >
        <div className="grid gap-3">
          <Radio
            className={[
              "retry-modal-mode-option",
              mode === "fresh" ? "bg-surface" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value="fresh"
          >
            <span className="shrink-0 whitespace-nowrap font-medium text-text">
              {t("modeFresh")}
            </span>{" "}
            <Text type="secondary" className="!text-sm">
              {t("modeFreshHint")}
            </Text>
          </Radio>
          <Radio
            className={[
              "retry-modal-mode-option",
              mode === "resume" ? "bg-surface" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value="resume"
            disabled={!hasAttempt}
          >
            <span className="shrink-0 whitespace-nowrap font-medium text-text">
              {t("modeResume")}
            </span>{" "}
            <Text type="secondary" className="!text-sm">
              {hasAttempt ? t("modeResumeHint") : t("modeResumeNone")}
            </Text>
          </Radio>
          <Radio
            className={[
              "retry-modal-mode-option",
              mode === "hint" ? "bg-surface" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value="hint"
            disabled
          >
            <span className="shrink-0 whitespace-nowrap font-medium text-text">
              {t("modeHint")}
            </span>{" "}
            <Text type="secondary" className="!text-sm">
              {t("modeHintHint")}
            </Text>
          </Radio>
        </div>
      </Radio.Group>

      {startErrorKey ? (
        // §4 예외 — 시작 실패 시 모달 유지, 오류 + 재시도.
        <Alert
          type="error"
          showIcon
          className="mb-3"
          title={t("startFailedTitle")}
          description={t(startErrorKey)}
        />
      ) : null}

      <div
        data-testid="retry-modal-actions"
        className="app-modal-footer-actions"
      >
        <Button className="!h-10" block onClick={onClose} disabled={risky}>
          {tActions("cancel")}
        </Button>
        <Button
          className="!h-10"
          type="primary"
          block
          onClick={handleStart}
          loading={starting}
          disabled={risky}
        >
          {startErrorKey ? t("retry") : tActions("start")}
        </Button>
      </div>
    </AppModal>
  );
}
