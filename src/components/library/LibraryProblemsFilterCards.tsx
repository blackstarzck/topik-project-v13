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
 * F-01 `/library/problems` 유형·상태 필터 그리드.
 * AntD Checkbox 기본 배치(체크박스 왼쪽, 라벨+개수 오른쪽)를 그대로 쓰고
 * 테두리 없는 텍스트 행으로 나열한다. 라벨 문구는 행 태그와 동일한 기존
 * 카탈로그 키를 재사용한다.
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
      {LIBRARY_PROBLEMS_FILTER_KEYS.map((key) => (
        <Checkbox
          key={key}
          checked={checked.has(key)}
          data-testid={`library-problems-filter-card-${key}`}
          onChange={() => onToggle(key)}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm text-text">{labels[key]}</span>
            <strong
              className="flex-none text-sm tabular-nums text-text-secondary"
              data-testid={`library-problems-filter-count-${key}`}
            >
              {counts[key]}
            </strong>
          </span>
        </Checkbox>
      ))}
    </section>
  );
}
