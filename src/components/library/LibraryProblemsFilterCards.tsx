"use client";

import { Checkbox } from "antd";
import { useTranslations } from "next-intl";

import {
  LIBRARY_PROBLEMS_FILTER_KEYS,
  type LibraryProblemsFilterKey,
} from "./library-problems-filters";

type Props = {
  counts: Record<LibraryProblemsFilterKey, number>;
  checked: ReadonlySet<LibraryProblemsFilterKey>;
  onToggle: (key: LibraryProblemsFilterKey) => void;
};

/**
 * F-01 `/library/problems` 유형·상태 필터 카드 그리드.
 * 카드 전체가 AntD Checkbox 라벨이며, 체크박스는 카드 끝(오른쪽)에 둔다.
 * 라벨 문구는 행 태그와 동일한 기존 카탈로그 키를 재사용한다.
 */
export function LibraryProblemsFilterCards({
  counts,
  checked,
  onToggle,
}: Props) {
  const t = useTranslations("library.problemsList");
  const tSubmissions = useTranslations("library.submissions");
  const tSaved = useTranslations("library.saved");

  const labels: Record<LibraryProblemsFilterKey, string> = {
    submissions: t("typeSubmission"),
    statusPending: tSubmissions("statusPending"),
    statusAnalyzing: tSubmissions("statusAnalyzing"),
    statusComplete: tSubmissions("statusComplete"),
    statusFailed: tSubmissions("statusFailed"),
    problems: t("typeProblem"),
    providedEnded: tSaved("providedEnded"),
    unavailable: tSaved("unavailable"),
  };

  return (
    <section
      aria-label={t("filterCardsAriaLabel")}
      data-testid="library-problems-filter-cards"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {LIBRARY_PROBLEMS_FILTER_KEYS.map((key) => {
        const selected = checked.has(key);
        return (
          <Checkbox
            key={key}
            checked={selected}
            data-testid={`library-problems-filter-card-${key}`}
            // flex-row-reverse: 체크박스를 카드 끝(오른쪽)으로 보낸다.
            // [&>span:last-child]:* 는 AntD 라벨 span을 남은 폭만큼 키우는
            // 레이아웃 글루로, 시각 상태(색/보더)는 건드리지 않는다.
            className={[
              "flex w-full flex-row-reverse items-center rounded-default border bg-background px-3 py-2 transition",
              "[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1",
              selected
                ? "border-text shadow-sm"
                : "border-border hover:border-text",
            ].join(" ")}
            onChange={() => onToggle(key)}
          >
            <span className="flex w-full min-w-0 items-center justify-between gap-2">
              <span className="truncate text-sm text-text">{labels[key]}</span>
              <strong
                className="flex-none text-sm tabular-nums text-text-secondary"
                data-testid={`library-problems-filter-count-${key}`}
              >
                {counts[key]}
              </strong>
            </span>
          </Checkbox>
        );
      })}
    </section>
  );
}
