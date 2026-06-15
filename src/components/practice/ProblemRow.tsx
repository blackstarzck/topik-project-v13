"use client";

import type { ReactNode } from "react";
import { Button, Tag, Tooltip, Typography } from "antd";
import { ChartNoAxesColumnIncreasing, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { ProblemRow as ProblemRowData } from "@/lib/practice/types";
import { writingProblemHref } from "@/lib/writing/routes";
import { difficultyKey } from "./difficulty";
import { getReasonTagColor } from "./reason-tag-colors";

const { Text } = Typography;

type Props = {
  row: ProblemRowData;
  isLast?: boolean;
  /** Phase 7-D Task 5: parent supplies retry handler when user has prior attempt/submission. */
  onRetryClick?: (problemId: string) => void;
  /** Phase 7-D Task 12: 저장 상태가 solved이면 retry 버튼 표시. */
  solveState?: "none" | "attempted" | "submitted";
  /** C-02 저장 이력: 시도 횟수(problem_attempts). */
  attemptCount?: number;
  /** C-02 저장 이력: 마지막 시도 시각(ISO). */
  lastAttemptAt?: string | null;
};

/**
 * i18n: returns a structured descriptor instead of a localized string so the
 * component can resolve it via `t()`. `absolute` carries a pre-formatted date
 * for the >=7 days branch (locale-specific formatting stays in the helper).
 */
type RelativeDay =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "daysAgo"; days: number }
  | { kind: "absolute"; text: string };

function relativeDay(iso: string | null | undefined): RelativeDay | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return { kind: "today" };
  if (days === 1) return { kind: "yesterday" };
  if (days < 7) return { kind: "daysAgo", days };
  return { kind: "absolute", text: new Date(iso).toLocaleDateString("ko-KR") };
}

function ProblemBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-secondary">
      {children}
    </span>
  );
}

export function ProblemRow({
  isLast,
  row,
  onRetryClick,
  solveState = "none",
  attemptCount = 0,
  lastAttemptAt,
}: Props) {
  const t = useTranslations("practice.problems");
  const tCommon = useTranslations("practice.common");
  const lifecycleStatus = row.lifecycle_status ?? "active";
  const disabled =
    row.publish_status !== "published" || lifecycleStatus !== "active";
  const hasPriorWork = solveState !== "none";
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
  const displayTitle =
    row.title.length > 32 ? `${row.title.slice(0, 32)}...` : row.title;
  // 추천 화면 유형 카드와 동일한 난이도 어휘를 쓰도록 공유 매핑 사용.
  const diffKey = difficultyKey(row.difficulty);
  const visibleTags = (Array.isArray(row.tags) ? row.tags : [])
    .filter((tag) => !tag.startsWith("seed:") && tag !== `q${row.question_no}`)
    .slice(0, 3);

  const action =
    hasPriorWork && onRetryClick ? (
      <Button
        className="w-full md:w-auto"
        onClick={() => onRetryClick(row.id)}
        disabled={disabled}
      >
        {t("retryAttempt")}
      </Button>
    ) : disabled ? (
      <Button className="w-full md:w-auto" type="primary" disabled>
        {t("startProblem")}
      </Button>
    ) : (
      <Link
        className="w-full md:w-auto"
        href={
          writingProblemHref({
            questionNo: row.question_no,
            problemId: row.id,
          }) as never
        }
      >
        <Button className="w-full md:w-auto" type="primary" disabled={disabled}>
          {t("startProblem")}
        </Button>
      </Link>
    );

  return (
    <div
      role="listitem"
      className={[
        "flex flex-col gap-4 bg-background py-4 md:flex-row md:items-center md:justify-between",
        isLast ? "" : "border-b border-border",
      ].join(" ")}
    >
      <div className="flex min-w-0 gap-3">
        {row.question_no ? (
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-default border border-border bg-surface text-lg font-bold tabular-nums text-primary"
            role="img"
            aria-label={tCommon("questionNo", { no: row.question_no })}
          >
            <span aria-hidden="true">{row.question_no}</span>
          </span>
        ) : (
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-default border border-border bg-surface text-text"
            aria-hidden="true"
          >
            <FileText size={20} />
          </span>
        )}
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <strong className="min-w-0 text-base font-semibold text-text">
              {displayTitle}
            </strong>
            {solveState === "submitted" ? (
              <ProblemBadge>{t("solveSolved")}</ProblemBadge>
            ) : solveState === "attempted" ? (
              <ProblemBadge>{t("solveInProgress")}</ProblemBadge>
            ) : null}
          </div>
          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {visibleTags.map((tag, index) => (
                <Tag
                  key={tag}
                  className="problem-row__tag"
                  color={getReasonTagColor(index, visibleTags.length)}
                  variant="filled"
                >
                  {tag}
                </Tag>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {diffKey ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <ChartNoAxesColumnIncreasing size={14} aria-hidden="true" />
                {tCommon(diffKey as Parameters<typeof tCommon>[0])}
              </span>
            ) : null}
            {disabled && row.lifecycle_reason ? (
              <Text type="secondary" className="!text-xs">
                {row.lifecycle_reason}
              </Text>
            ) : null}
            {/* C-02 저장 이력 (problem_attempts.attempt_count + 마지막 시도). */}
            {attemptCount > 0 ? (
              <Tooltip
                title={
                  lastLabel ? t("lastAttempt", { date: lastLabel }) : undefined
                }
              >
                <Text type="secondary" className="!text-xs">
                  {t("attemptCount", { count: attemptCount })}
                  {lastLabel ? ` · ${lastLabel}` : ""}
                </Text>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex w-full justify-end md:w-auto">{action}</div>
    </div>
  );
}
