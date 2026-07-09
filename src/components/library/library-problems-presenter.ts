/**
 * F-01 `/library/problems` 행·카드가 공유하는 표시용 헬퍼.
 * LibraryProblemsList에서 분리해 리스트 행(LibraryProblemsRows)과
 * 카드(LibraryProblemsItemCard)가 같은 규칙을 쓰게 한다.
 */

import type {
  LibraryDraftView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";

import type { SubmissionEnrichment } from "./library-enrich-data";

export type MixedLibraryProblemItem =
  | {
      kind: "submission";
      item: LibrarySubmissionView;
      savedAt: string;
    }
  | {
      kind: "problem";
      item: LibraryProblemView;
      savedAt: string;
    }
  | {
      kind: "draft";
      item: LibraryDraftView;
      savedAt: string;
    };

export type LibraryListTranslate = (
  key: string,
  values?: Record<string, string | number | null | undefined>,
) => string;

export function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function stripQuestionNumberPrefix(title: string): string {
  return title.replace(/^\s*No\.\s*5[1-4]\s*(?:[-–—:]\s*)?/i, "").trim();
}

export function submissionTitle(
  item: LibrarySubmissionView,
  fallbackTitle: string,
): string {
  const title = item.problem_title ?? fallbackTitle;
  return stripQuestionNumberPrefix(title);
}

export function problemTitle(title: string | null, fallbackTitle: string) {
  return stripQuestionNumberPrefix(title ?? fallbackTitle);
}

export function answerPreview(answerText: string | null): string | null {
  return answerText?.trim() ? answerText : null;
}

export function draftTitle(
  item: LibraryDraftView,
  fallbackTitle: string,
): string {
  return stripQuestionNumberPrefix(item.problem_title ?? fallbackTitle);
}

export function isAnalysisPendingStatus(
  status: SubmissionEnrichment["feedbackStatus"],
): boolean {
  return status === "pending" || status === "analyzing";
}
