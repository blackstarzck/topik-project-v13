"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Button, ConfigProvider, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ChartNoAxesColumnIncreasing,
  Clock3,
  FileText,
  Trophy,
} from "@/components/shared/AppIcons";
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
import type { UserProblemRow } from "./problem-list-data";
import { getReasonTagColor } from "./reason-tag-colors";

type Props = {
  rows: UserProblemRow[];
  onRetryClick: (row: UserProblemRow) => void;
};

const PROBLEM_TABLE_THEME = {
  components: {
    Table: {
      borderColor:
        "color-mix(in srgb, var(--app-color-border) 35%, transparent)",
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

function isAnalysisHandoff(row: UserProblemRow): boolean {
  return (
    Boolean(row.latestSubmissionId) &&
    (row.feedbackStatus === "pending" || row.feedbackStatus === "analyzing")
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest("a, button, input, select, textarea, label, summary"),
    )
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
    if (isAnalysisHandoff(row)) return;
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

  function handleRowClick(row: UserProblemRow, event: MouseEvent<HTMLElement>) {
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
        const analysisFailedBadge =
          row.feedbackStatus === "failed"
            ? {
                labelKey: "analysisFailedBadge",
                color: "red",
              }
            : null;

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
                <strong className="problem-table__title">{row.title}</strong>
                {displayMeta.isNew ? (
                  <span className="problem-table__new-badge">
                    {t("newBadge")}
                  </span>
                ) : null}
                {analysisFailedBadge ? (
                  <Tag
                    className="problem-table__tag"
                    color={analysisFailedBadge.color}
                    aria-label={t("analysisFailedTooltip")}
                  >
                    {t(analysisFailedBadge.labelKey as Parameters<typeof t>[0])}
                  </Tag>
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
              difficultyBucketShortKey(diffBucket) as Parameters<
                typeof tCommon
              >[0],
            )
          : "-";
        const title = diffBucket
          ? tCommon(
              difficultyBucketLabelKey(diffBucket) as Parameters<
                typeof tCommon
              >[0],
            )
          : undefined;

        return (
          <span
            className="problem-table__value tabular-nums"
            aria-label={title}
          >
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
      title: null,
      key: "action",
      width: 132,
      align: "right",
      render: (_value: unknown, row) => {
        const disabled = isDisabled(row);
        const analysisHandoff = isAnalysisHandoff(row);
        const rowHasPriorWork = hasPriorWork(row);

        const button = analysisHandoff ? (
          <Button
            className="problem-table__action-button problem-table__action-button--secondary"
            variant="outlined"
            disabled
          >
            {t("analysisStatusAction")}
          </Button>
        ) : rowHasPriorWork ? (
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

        if (analysisHandoff || rowHasPriorWork || disabled) {
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
    <div className="problem-table__interaction-surface">
      <ConfigProvider theme={PROBLEM_TABLE_THEME}>
        <Table<UserProblemRow>
          className="problem-table"
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowClassName={(row) =>
            [
              "problem-table__row",
              !isDisabled(row) && !isAnalysisHandoff(row)
                ? "problem-table__row--selectable"
                : "",
              isDisabled(row) ? "problem-table__row--disabled" : "",
              isAnalysisHandoff(row) ? "problem-table__row--analysis" : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
          rowKey="problemId"
          onRow={(row) => {
            const disabled = isDisabled(row);
            return {
              "aria-disabled": disabled ? true : undefined,
              "aria-label": `${row.title} ${
                isAnalysisHandoff(row)
                  ? t("analysisStatusAction")
                  : hasPriorWork(row)
                    ? t("retryAttempt")
                    : t("startProblem")
              }`,
              onClick: (event) => handleRowClick(row, event),
              onKeyDown: (event) => handleRowKeyDown(row, event),
              tabIndex: disabled || isAnalysisHandoff(row) ? -1 : 0,
            };
          }}
          scroll={{ x: 840 }}
          size="medium"
          tableLayout="fixed"
        />
      </ConfigProvider>
    </div>
  );
}
