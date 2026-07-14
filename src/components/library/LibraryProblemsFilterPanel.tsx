"use client";

/**
 * F-01 `/library/problems` 우측 필터 패널 콘텐츠.
 * 데스크톱 aside와 모바일 Drawer가 같은 콘텐츠를 공유한다. 필터 의미론
 * (그룹 간 AND, 항목 유형 트리의 브랜치 합집합)은 library-problems-filter-model
 * 이 단일 소스이고, 이 컴포넌트는 상태 표시와 onChange 위임만 담당한다.
 * Component tests가 표시와 onChange 위임의 실행 계약을 고정한다.
 */

import {
  Button,
  Checkbox,
  DatePicker,
  Radio,
  Slider,
  Tooltip,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { ListFilter, RefreshCcw } from "@/components/shared/AppIcons";

import {
  LIBRARY_PROBLEMS_QUESTION_NOS,
  normalizeScoreRange,
  resolveDatePreset,
  type LibraryProblemsAvailability,
  type LibraryProblemsDatePreset,
  type LibraryProblemsFacetCounts,
  type LibraryProblemsFilterState,
  type LibraryProblemsKind,
  type LibraryProblemsQuestionNo,
  type LibraryProblemsStatus,
} from "./library-problems-filter-model";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const FULL_SCORE_RANGE: readonly [number, number] = [0, 100];

type Props = {
  state: LibraryProblemsFilterState;
  counts: LibraryProblemsFacetCounts;
  activeCount: number;
  onChange: (partial: Partial<LibraryProblemsFilterState>) => void;
  onReset: () => void;
  /** Drawer에서는 Drawer 헤더가 제목을 대신하므로 패널 헤더를 숨긴다. */
  showHeader?: boolean;
};

function toggleSet<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function FilterGroup({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col gap-3 border-b border-border pb-5 last:border-b-0 last:pb-0"
    >
      <Text strong>{label}</Text>
      {children}
    </section>
  );
}

function CheckboxRow({
  checked,
  indeterminate,
  count,
  label,
  testId,
  onToggle,
}: {
  checked: boolean;
  indeterminate?: boolean;
  count: number;
  label: string;
  testId: string;
  onToggle: () => void;
}) {
  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      data-testid={testId}
      onChange={onToggle}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-sm text-text">{label}</span>
        <strong
          className="flex-none text-sm tabular-nums text-text-secondary"
          data-testid={`${testId}-count`}
        >
          {count}
        </strong>
      </span>
    </Checkbox>
  );
}

export function LibraryProblemsFilterPanel({
  state,
  counts,
  activeCount,
  onChange,
  onReset,
  showHeader = true,
}: Props) {
  const t = useTranslations("library.problemsList");
  const tSubmissions = useTranslations("library.submissions");
  const tSaved = useTranslations("library.saved");

  // Slider 드래그 중 표시용 draft — 커밋은 onChangeComplete에서만 한다.
  const [scoreDraft, setScoreDraft] = useState<
    readonly [number, number] | null
  >(null);
  const scoreValue = scoreDraft ?? state.scoreRange ?? FULL_SCORE_RANGE;

  const statusRows: readonly {
    status: LibraryProblemsStatus;
    label: string;
  }[] = [
    { status: "pending", label: tSubmissions("statusPending") },
    { status: "analyzing", label: tSubmissions("statusAnalyzing") },
    { status: "complete", label: tSubmissions("statusComplete") },
    { status: "failed", label: tSubmissions("statusFailed") },
  ];

  const availabilityRows: readonly {
    availability: LibraryProblemsAvailability;
    label: string;
  }[] = [
    { availability: "soft_unavailable", label: tSaved("providedEnded") },
    { availability: "hard_unavailable", label: tSaved("unavailable") },
  ];

  const datePresetValue =
    state.date == null ? "all" : (state.date.preset ?? undefined);
  const dateRangeValue: [Dayjs | null, Dayjs | null] | null = state.date
    ? [
        state.date.from ? dayjs(state.date.from) : null,
        state.date.to ? dayjs(state.date.to) : null,
      ]
    : null;

  const toggleKind = (kind: LibraryProblemsKind) =>
    onChange({ kinds: toggleSet(state.kinds, kind) });

  return (
    <div
      aria-label={t("filterPanelAriaLabel")}
      data-testid="library-problems-filter-panel"
      className="flex w-full flex-col gap-6"
      role="group"
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <span className="flex items-center gap-2">
            <ListFilter aria-hidden className="text-text-secondary" size={16} />
            <Text strong>{t("filterPanelTitle")}</Text>
            <Text
              data-testid="library-problems-filter-active-count"
              type="secondary"
            >
              {activeCount}
            </Text>
          </span>
          <Tooltip title={tSaved("resetFilter")}>
            <Button
              aria-label={tSaved("resetFilter")}
              className="mr-2"
              data-testid="library-problems-filter-reset"
              disabled={activeCount === 0}
              icon={<RefreshCcw aria-hidden size={18} />}
              size="small"
              title={tSaved("resetFilter")}
              type="text"
              onClick={onReset}
            />
          </Tooltip>
        </div>
      ) : null}

      <FilterGroup
        label={t("groupQuestionType")}
        testId="library-problems-filter-group-question-type"
      >
        <div className="flex flex-col gap-3">
          {LIBRARY_PROBLEMS_QUESTION_NOS.map((questionNo) => (
            <CheckboxRow
              key={questionNo}
              checked={state.questionNos.has(questionNo)}
              count={counts.questionNos[questionNo]}
              label={t("questionNoLabel", { no: questionNo })}
              testId={`library-problems-filter-question-${questionNo}`}
              onToggle={() =>
                onChange({
                  questionNos: toggleSet(
                    state.questionNos,
                    questionNo as LibraryProblemsQuestionNo,
                  ),
                })
              }
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup
        label={t("groupItemType")}
        testId="library-problems-filter-group-item-type"
      >
        <div className="flex flex-col gap-3">
          <CheckboxRow
            checked={state.kinds.has("submission")}
            indeterminate={
              state.statuses.size > 0 && !state.kinds.has("submission")
            }
            count={counts.kinds.submission}
            label={t("typeSubmission")}
            testId="library-problems-filter-kind-submission"
            onToggle={() => toggleKind("submission")}
          />
          <CheckboxRow
            checked={state.kinds.has("problem")}
            indeterminate={
              state.availability.size > 0 && !state.kinds.has("problem")
            }
            count={counts.kinds.problem}
            label={t("typeProblem")}
            testId="library-problems-filter-kind-problem"
            onToggle={() => toggleKind("problem")}
          />
          <CheckboxRow
            checked={state.kinds.has("draft")}
            count={counts.kinds.draft}
            label={t("typeDraft")}
            testId="library-problems-filter-kind-draft"
            onToggle={() => toggleKind("draft")}
          />
        </div>
      </FilterGroup>

      <FilterGroup
        label={t("groupSubmissionStatus")}
        testId="library-problems-filter-group-submission-status"
      >
        <div className="flex flex-col gap-3">
          {statusRows.map(({ status, label }) => (
            <CheckboxRow
              key={status}
              checked={state.statuses.has(status)}
              count={counts.statuses[status]}
              label={label}
              testId={`library-problems-filter-status-${status}`}
              onToggle={() =>
                onChange({ statuses: toggleSet(state.statuses, status) })
              }
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup
        label={t("groupProblemAvailability")}
        testId="library-problems-filter-group-problem-availability"
      >
        <div className="flex flex-col gap-3">
          {availabilityRows.map(({ availability, label }) => (
            <CheckboxRow
              key={availability}
              checked={state.availability.has(availability)}
              count={counts.availability[availability]}
              label={label}
              testId={`library-problems-filter-availability-${availability}`}
              onToggle={() =>
                onChange({
                  availability: toggleSet(state.availability, availability),
                })
              }
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label={t("groupDate")}>
        <div
          data-testid="library-problems-filter-date-stack"
          className="flex flex-col gap-4"
        >
          <Radio.Group
            className="library-problems-date-presets grid grid-cols-2 gap-x-8 gap-y-5"
            data-testid="library-problems-filter-date-presets"
            value={datePresetValue}
            onChange={(event) => {
              const value = event.target.value as
                | "all"
                | LibraryProblemsDatePreset;
              onChange({
                date: value === "all" ? null : resolveDatePreset(value),
              });
            }}
            options={[
              { value: "all", label: t("datePresetAll") },
              { value: "week", label: t("datePresetWeek") },
              { value: "month", label: t("datePresetMonth") },
              { value: "quarter", label: t("datePresetQuarter") },
            ]}
          />
          <span
            data-testid="library-problems-filter-date-range"
            className="block px-3"
          >
            <RangePicker
              allowEmpty={[true, true]}
              aria-label={t("dateRangeAriaLabel")}
              className="w-full"
              value={dateRangeValue ?? undefined}
              onChange={(value) => {
                const from = value?.[0]?.startOf("day").toISOString() ?? null;
                const to = value?.[1]?.endOf("day").toISOString() ?? null;
                onChange({
                  date:
                    from == null && to == null
                      ? null
                      : { preset: null, from, to },
                });
              }}
            />
          </span>
        </div>
      </FilterGroup>

      <FilterGroup label={t("groupScore")}>
        <span
          data-testid="library-problems-filter-score-slider"
          className="block px-3"
        >
          <Slider
            range
            ariaLabelForHandle={[
              t("scoreMinAriaLabel"),
              t("scoreMaxAriaLabel"),
            ]}
            max={100}
            min={0}
            step={5}
            value={[scoreValue[0], scoreValue[1]]}
            onChange={(value) => setScoreDraft([value[0], value[1]])}
            onChangeComplete={(value) => {
              setScoreDraft(null);
              onChange({
                scoreRange: normalizeScoreRange([value[0], value[1]]),
              });
            }}
          />
        </span>
        <div className="flex items-center justify-between gap-2">
          <Text data-testid="library-problems-filter-score-value">
            {t("scoreRangeValue", { min: scoreValue[0], max: scoreValue[1] })}
          </Text>
        </div>
        <Text type="secondary">{t("scoreCaption")}</Text>
      </FilterGroup>
    </div>
  );
}
