"use client";

import { Badge, Button, Space, Tag, Tooltip, Typography } from "antd";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { AppStackListItem } from "@/components/shared/AppStackList";
import type { ProblemRow as ProblemRowData } from "@/lib/practice/types";
import { writingProblemHref } from "@/lib/writing/routes";

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
  const statusLabel =
    row.publish_status !== "published"
      ? t("statusUnpublished")
      : lifecycleStatus === "expired"
        ? t("statusExpired")
        : lifecycleStatus === "inactive"
          ? t("statusInactive")
          : t("statusPublished");
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
  const visibleTags = (Array.isArray(row.tags) ? row.tags : [])
    .filter((tag) => !tag.startsWith("seed:") && tag !== `q${row.question_no}`)
    .slice(0, 3);

  const action =
    hasPriorWork && onRetryClick ? (
      <Button onClick={() => onRetryClick(row.id)} disabled={disabled}>
        {t("retryAttempt")}
      </Button>
    ) : disabled ? (
      <Button type="primary" disabled>
        {t("startProblem")}
      </Button>
    ) : (
      <Link
        href={
          writingProblemHref({
            questionNo: row.question_no,
            problemId: row.id,
          }) as never
        }
      >
        <Button type="primary" disabled={disabled}>
          {t("startProblem")}
        </Button>
      </Link>
    );

  return (
    <AppStackListItem
      actions={action}
      className="problem-list-row"
      isLast={isLast}
    >
      <div className="problem-list-row__content">
        <span
          className={[
            "problem-list-row__icon",
            row.question_no ? `is-type-${row.question_no}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          <FileText size={20} />
        </span>
        <Space
          className="problem-list-row__body"
          orientation="vertical"
          size={6}
        >
          <Space className="problem-list-row__titleline" wrap>
            {row.question_no ? (
              <Tag>{tCommon("questionNo", { no: row.question_no })}</Tag>
            ) : null}
            <strong className="problem-list-row__title">{displayTitle}</strong>
            {solveState === "submitted" ? (
              <Tag color="green">{t("solveSolved")}</Tag>
            ) : solveState === "attempted" ? (
              <Tag color="orange">{t("solveInProgress")}</Tag>
            ) : null}
          </Space>
          {visibleTags.length > 0 ? (
            <Space className="problem-list-row__tags" size={4} wrap>
              {visibleTags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          ) : null}
          <Space className="problem-list-row__meta" size="small" wrap>
            {row.difficulty != null ? (
              <Tag color="blue">
                {tCommon("difficultyValue", { level: row.difficulty })}
              </Tag>
            ) : null}
            <Badge
              status={disabled ? "default" : "success"}
              text={statusLabel}
            />
            {disabled && row.lifecycle_reason ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
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
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t("attemptCount", { count: attemptCount })}
                  {lastLabel ? ` · ${lastLabel}` : ""}
                </Text>
              </Tooltip>
            ) : null}
          </Space>
        </Space>
      </div>
    </AppStackListItem>
  );
}
