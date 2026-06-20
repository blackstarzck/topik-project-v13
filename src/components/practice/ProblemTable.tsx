"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Button, ConfigProvider, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  Clock3,
  FileText,
  Trophy,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { writingProblemHref } from "@/lib/writing/routes";
import {
  difficultyBucket,
  difficultyBucketLabelKey,
  difficultyBucketShortKey,
} from "./difficulty";
import { getProblemRowDisplayMeta } from "./problem-list-display";
import type { ProblemRowSolveStatus } from "./problem-list-display";
import type { UserProblemRow } from "./problem-list-data";
import { getReasonTagColor } from "./reason-tag-colors";

type Props = {
  rows: UserProblemRow[];
  onRetryClick: (row: UserProblemRow) => void;
};

const STATUS_LABEL_KEYS: Record<
  ProblemRowSolveStatus,
  | "rowStatusUnsolved"
  | "rowStatusCompleted"
  | "rowStatusWrongNote"
  | "rowStatusReviewNeeded"
> = {
  unsolved: "rowStatusUnsolved",
  completed: "rowStatusCompleted",
  wrongNote: "rowStatusWrongNote",
  reviewNeeded: "rowStatusReviewNeeded",
};

const PROBLEM_TABLE_THEME = {
  components: {
    Table: {
      borderColor: "color-mix(in srgb, var(--app-color-border) 35%, transparent)",
      headerBg: "var(--app-color-bg-container)",
      headerColor: "var(--app-color-text-secondary)",
      headerSplitColor: "transparent",
      rowHoverBg:
        "color-mix(in srgb, var(--app-color-bg-layout) 65%, var(--app-color-bg-container))",
    },
  },
};

function ColumnTitle({
  children,
  icon,
  variant = "center",
}: {
  children: ReactNode;
  icon: ReactNode;
  variant?: "center" | "problem";
}) {
  return (
    <span
      className={[
        "problem-table__column-title",
        `problem-table__column-title--${variant}`,
      ].join(" ")}
    >
      <span className="problem-table__column-title-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  );
}

function isDisabled(row: UserProblemRow): boolean {
  return row.publishStatus !== "published" || row.lifecycleStatus !== "active";
}

function hasPriorWork(row: UserProblemRow): boolean {
  return getProblemRowDisplayMeta(row).solveStatus !== "unsolved";
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, select, textarea, label, summary"))
  );
}

function visibleTags(row: UserProblemRow): string[] {
  return row.tags
    .filter((tag) => !tag.startsWith("seed:") && tag !== `q${row.questionNo}`)
    .slice(0, 3);
}

export function ProblemTable({ rows, onRetryClick }: Props) {
  const router = useRouter();
  const t = useTranslations("practice.problems");
  const tCommon = useTranslations("practice.common");

  function selectRow(row: UserProblemRow) {
    if (isDisabled(row)) return;
    if (hasPriorWork(row)) {
      onRetryClick(row);
      return;
    }

    router.push(
      writingProblemHref({
        questionNo: row.questionNo,
        problemId: row.problemId,
      }) as never,
    );
  }

  function handleRowClick(
    row: UserProblemRow,
    event: MouseEvent<HTMLElement>,
  ) {
    if (isInteractiveTarget(event.target)) return;
    selectRow(row);
  }

  function handleRowKeyDown(
    row: UserProblemRow,
    event: KeyboardEvent<HTMLElement>,
  ) {
    if (isInteractiveTarget(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    selectRow(row);
  }

  const columns: ColumnsType<UserProblemRow> = [
    {
      title: (
        <ColumnTitle icon={<FileText size={14} />} variant="problem">
          {t("problemColumnLabel")}
        </ColumnTitle>
      ),
      key: "problem",
      dataIndex: "title",
      minWidth: 320,
      rowScope: "row",
      render: (_title: string, row) => {
        const displayMeta = getProblemRowDisplayMeta(row);
        const tags = visibleTags(row);
        const displayTitle =
          row.title.length > 32 ? `${row.title.slice(0, 32)}...` : row.title;

        return (
          <div className="problem-table__problem-cell">
            <span
              className={[
                "problem-table__type-index",
                row.questionNo != null
                  ? "problem-table__type-index--number tabular-nums"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={
                row.questionNo
                  ? tCommon("questionNo", { no: row.questionNo })
                  : undefined
              }
            >
              {row.questionNo ?? "-"}
            </span>
            <div className="problem-table__copy">
              <div className="problem-table__title-line">
                <strong className="problem-table__title" title={row.title}>
                  {displayTitle}
                </strong>
                {displayMeta.isNew ? (
                  <span className="problem-table__new-badge">
                    {t("newBadge")}
                  </span>
                ) : null}
              </div>
              {tags.length > 0 ? (
                <div className="problem-table__tags">
                  {tags.map((tag, index) => (
                    <Tag
                      key={tag}
                      className="problem-table__tag"
                      color={getReasonTagColor(index, tags.length)}
                      variant="filled"
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              ) : null}
              {isDisabled(row) && row.lifecycleReason ? (
                <span className="problem-table__disabled-reason">
                  {row.lifecycleReason}
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <ColumnTitle icon={<ChartNoAxesColumnIncreasing size={14} />}>
          {t("difficultyLabel")}
        </ColumnTitle>
      ),
      key: "difficulty",
      dataIndex: "difficulty",
      align: "center",
      width: 116,
      render: (_difficulty: number | null, row) => {
        const diffBucket = difficultyBucket(row.difficulty);
        const value = diffBucket
          ? tCommon(
              difficultyBucketShortKey(
                diffBucket,
              ) as Parameters<typeof tCommon>[0],
            )
          : "-";
        const title = diffBucket
          ? tCommon(
              difficultyBucketLabelKey(
                diffBucket,
              ) as Parameters<typeof tCommon>[0],
            )
          : undefined;

        return (
          <span className="problem-table__value tabular-nums" title={title}>
            {value}
          </span>
        );
      },
    },
    {
      title: (
        <ColumnTitle icon={<Clock3 size={14} />}>
          {t("estimatedTimeLabel")}
        </ColumnTitle>
      ),
      key: "estimatedTime",
      align: "center",
      width: 136,
      render: (_value: unknown, row) => {
        const displayMeta = getProblemRowDisplayMeta(row);
        const estimatedTime =
          displayMeta.estimatedMinutes != null
            ? tCommon("minutes", { minutes: displayMeta.estimatedMinutes })
            : "-";

        return <span className="problem-table__value">{estimatedTime}</span>;
      },
    },
    {
      title: (
        <ColumnTitle icon={<Trophy size={14} />}>
          {t("previousScoreLabel")}
        </ColumnTitle>
      ),
      key: "previousScore",
      align: "center",
      width: 136,
      render: (_value: unknown, row) => {
        const displayMeta = getProblemRowDisplayMeta(row);
        const previousScore =
          displayMeta.previousScore != null
            ? tCommon("score", { score: displayMeta.previousScore })
            : "-";

        return <span className="problem-table__value">{previousScore}</span>;
      },
    },
    {
      title: (
        <ColumnTitle icon={<CheckCircle2 size={14} />}>
          {t("solveStatusLabel")}
        </ColumnTitle>
      ),
      key: "solveStatus",
      align: "center",
      width: 132,
      render: (_value: unknown, row) => {
        const displayMeta = getProblemRowDisplayMeta(row);
        const rowStatusLabel = t(
          STATUS_LABEL_KEYS[
            displayMeta.solveStatus
          ] as Parameters<typeof t>[0],
        );

        return (
          <span
            className={[
              "problem-table__status-pill",
              `problem-table__status-pill--${displayMeta.solveStatus}`,
            ].join(" ")}
          >
            {rowStatusLabel}
          </span>
        );
      },
    },
    {
      title: null,
      key: "action",
      width: 132,
      align: "right",
      render: (_value: unknown, row) => {
        const disabled = isDisabled(row);
        const rowHasPriorWork = hasPriorWork(row);

        const button = rowHasPriorWork ? (
          <Button
            className="problem-table__action-button problem-table__action-button--secondary"
            variant="outlined"
            onClick={() => onRetryClick(row)}
            disabled={disabled}
          >
            {t("retryAttempt")}
          </Button>
        ) : (
          <Button
            className="problem-table__action-button problem-table__action-button--primary"
            size="large"
            disabled={disabled}
          >
            {t("startProblem")}
          </Button>
        );

        if (rowHasPriorWork || disabled) {
          return <div className="problem-table__action">{button}</div>;
        }

        return (
          <div className="problem-table__action">
            <Link
              className="problem-table__action-link"
              href={
                writingProblemHref({
                  questionNo: row.questionNo,
                  problemId: row.problemId,
                }) as never
              }
            >
              {button}
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <ConfigProvider theme={PROBLEM_TABLE_THEME}>
      <Table<UserProblemRow>
        className="problem-table"
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowClassName={(row) =>
          [
            "problem-table__row",
            !isDisabled(row) ? "problem-table__row--selectable" : "",
            isDisabled(row) ? "problem-table__row--disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
        rowKey="problemId"
        onRow={(row) => {
          const disabled = isDisabled(row);
          return {
            "aria-disabled": disabled ? true : undefined,
            "aria-label": `${row.title} ${hasPriorWork(row) ? t("retryAttempt") : t("startProblem")}`,
            onClick: (event) => handleRowClick(row, event),
            onKeyDown: (event) => handleRowKeyDown(row, event),
            tabIndex: disabled ? -1 : 0,
          };
        }}
        scroll={{ x: 980 }}
        size="medium"
        tableLayout="fixed"
      />
    </ConfigProvider>
  );
}
