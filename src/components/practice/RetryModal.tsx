"use client";

import {
  Alert,
  Button,
  Descriptions,
  Radio,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppModal } from "@/components/shared/AppModal";
import { writingProblemHref } from "@/lib/writing/routes";

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
  /**
   * C-03 §2 예외 — 문제 만료 시 시작 대신 만료 안내 + 닫기만 제공.
   * 현재 problems 스키마에 만료 컬럼이 없어 기본 false; 추천 만료(run.expires_at)
   * 등 상위에서 만료를 판단해 주입하는 seam.
   */
  expired?: boolean;
};

function feedbackPathFor(questionNo: number | null, submissionId: string): string {
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
      router.push(
        writingProblemHref({
          questionNo,
          problemId,
          fresh: mode === "fresh",
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
    if (hasSubmission && submissionId) {
      router.push(feedbackPathFor(questionNo, submissionId) as never);
      return;
    }
    router.push("/practice/problems" as never);
  }

  const canViewResult = hasSubmission;
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
  const statusLabel = hasSubmission
    ? t("statusSubmitted")
    : hasAttempt
      ? t("statusDrafting")
      : t("statusNone");

  // §1 예외 — 위험 상태(시작 처리 중)에서는 배경 클릭/ESC 닫기 비활성.
  const risky = starting;

  const summary = (
    <Descriptions
      className="retry-modal-summary"
      size="small"
      column={1}
      bordered
    >
      <Descriptions.Item label={t("summaryProblem")}>
        {(problemTitle ?? t("summaryFallbackProblem")).slice(0, 28)}
      </Descriptions.Item>
      <Descriptions.Item label={t("summaryType")}>
        {questionNo ? (
          <Tag>{tCommon("questionNo", { no: questionNo })}</Tag>
        ) : (
          "—"
        )}
      </Descriptions.Item>
      <Descriptions.Item label={t("summaryPreviousStatus")}>
        <Space orientation="vertical" size={0}>
          <Text>
            {statusLabel}
            {attemptCount > 0
              ? ` · ${tCommon("attemptCount", { count: attemptCount })}`
              : ""}
            {lastLabel ? ` · ${lastLabel}` : ""}
          </Text>
          {canViewResult ? (
            <Button
              type="link"
              size="small"
              onClick={handleViewResult}
              disabled={risky}
            >
              {t("viewResult")}
            </Button>
          ) : null}
        </Space>
      </Descriptions.Item>
    </Descriptions>
  );

  // §2 예외 — 만료된 문제: 시작/모드 선택 숨기고 만료 안내 + 닫기만.
  if (expired) {
    return (
      <AppModal
        open={open}
        onCancel={onClose}
        title={t("expiredTitle")}
        footer={null}
        mask={{ closable: true }}
        destroyOnHidden
      >
        {summary}
        <Alert
          className="retry-modal-alert"
          type="warning"
          showIcon
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
      mask={{ closable: !risky }}
      keyboard={!risky}
      destroyOnHidden
    >
      {summary}

      <Paragraph className="retry-modal-intro" type="secondary">
        {t("intro")}
      </Paragraph>

      {/* §3 — 재풀이 모드 선택 (기본 선택 1개 항상 존재). */}
      <Radio.Group
        className="retry-modal-mode-group"
        value={mode}
        onChange={(e) => setMode(e.target.value as RetryMode)}
      >
        <Space className="retry-modal-mode-stack" orientation="vertical">
          <Radio value="fresh">
            {t("modeFresh")}{" "}
            <Text type="secondary">{t("modeFreshHint")}</Text>
          </Radio>
          <Radio value="resume" disabled={!hasAttempt}>
            {t("modeResume")}{" "}
            <Text type="secondary">
              {hasAttempt ? t("modeResumeHint") : t("modeResumeNone")}
            </Text>
          </Radio>
          {/* 힌트 포함 모드는 아직 준비 중(deferred) — 비활성 + 정직한 안내. */}
          <Tooltip title={t("modeHintTooltip")}>
            <Radio value="hint" disabled>
              {t("modeHint")} <Text type="secondary">{t("modeHintHint")}</Text>
            </Radio>
          </Tooltip>
        </Space>
      </Radio.Group>

      {startErrorKey ? (
        // §4 예외 — 시작 실패 시 모달 유지, 오류 + 재시도.
        <Alert
          className="retry-modal-alert"
          type="error"
          showIcon
          title={t("startFailedTitle")}
          description={t(startErrorKey)}
        />
      ) : null}

      <div
        className="retry-modal-actions"
        data-testid="retry-modal-actions"
      >
        <Button block onClick={onClose} disabled={risky}>
          {tActions("cancel")}
        </Button>
        <Button
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
