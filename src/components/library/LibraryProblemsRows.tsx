"use client";

/**
 * F-01 `/library/problems` 혼합 리스트의 행 렌더러.
 * LibraryProblemsList에서 추출한 공유 행 컴포넌트로, 리스트 뷰에서 쓰고
 * 다시 풀기 액션은 카드 뷰(LibraryProblemsItemCard)와 공유한다.
 */

import { Button, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  clampTitle,
  type SubmissionEnrichment,
} from "@/components/library/library-enrich-data";
import type {
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";
import { writingFeedbackHref, writingProblemHref } from "@/lib/writing/routes";

import { LibraryItemRow } from "./LibraryItemRow";
import { LibraryProblemsQuestionNumber } from "./LibraryProblemsQuestionNumber";
import {
  isAnalysisPendingStatus,
  problemTitle,
  submissionTitle,
  type LibraryListTranslate,
} from "./library-problems-presenter";

const { Paragraph, Text } = Typography;

export function LibraryProblemsSubmissionRow({
  item,
  meta,
}: {
  item: LibrarySubmissionView;
  meta: SubmissionEnrichment | undefined;
}) {
  const tSubmissions = useTranslations(
    "library.submissions",
  ) as LibraryListTranslate;
  const feedbackStatus = meta?.feedbackStatus ?? "pending";
  const analysisPending = isAnalysisPendingStatus(feedbackStatus);
  const fallbackTitle = tSubmissions("problemTitle", {
    id: item.problem_id.slice(0, 8),
  });
  const title = submissionTitle(item, fallbackTitle);

  return (
    <LibraryItemRow
      itemId={item.item_id}
      showDeleteAction={false}
      tab="submissions"
      tags={item.tags}
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <LibraryProblemsQuestionNumber questionNo={item.question_no} />
          {analysisPending ? (
            <Text strong>{clampTitle(title)}</Text>
          ) : (
            <Link
              href={
                writingFeedbackHref({
                  questionNo: item.question_no,
                  submissionId: item.id,
                }) as never
              }
            >
              <Text strong>{clampTitle(title)}</Text>
            </Link>
          )}
          {meta?.scoreTotal != null ? (
            <Tag>
              {meta.scoreMax != null
                ? tSubmissions("scoreWithMax", {
                    total: meta.scoreTotal,
                    max: meta.scoreMax,
                  })
                : tSubmissions("scoreNoMax", { total: meta.scoreTotal })}
            </Tag>
          ) : null}
        </div>
        {meta?.summary ? (
          <Paragraph className="mb-0" ellipsis={{ rows: 2 }} type="secondary">
            {meta.summary}
          </Paragraph>
        ) : analysisPending ? (
          <Paragraph className="mb-0" type="secondary">
            {tSubmissions("analysisPendingHint")}
          </Paragraph>
        ) : null}
      </div>
    </LibraryItemRow>
  );
}

export function LibraryProblemsProblemRow({
  item,
}: {
  item: LibraryProblemView;
}) {
  const tSaved = useTranslations("library.saved");
  const unavailable = item.availabilityStatus !== "available";
  const title = problemTitle(item.title, tSaved("unavailablePlaceholderTitle"));

  return (
    <LibraryItemRow
      className={unavailable ? "opacity-40" : undefined}
      itemId={item.item_id}
      showDeleteAction={false}
      tab="problems"
      tags={item.tags}
      trailingActions={[<LibraryProblemsRetryAction key="retry" item={item} />]}
    >
      <div className="flex w-full min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <LibraryProblemsQuestionNumber questionNo={item.question_no} />
          <Text strong>{title}</Text>
          {unavailable ? (
            <Tag data-testid="library-problem-unavailable-badge">
              {item.availabilityStatus === "soft_unavailable"
                ? tSaved("providedEnded")
                : tSaved("unavailable")}
            </Tag>
          ) : null}
        </div>
        {unavailable ? (
          <Text
            data-testid="library-problem-unavailable-reason"
            type="secondary"
          >
            {item.availabilityReason ?? tSaved("unavailableDefaultReason")}
          </Text>
        ) : null}
      </div>
    </LibraryItemRow>
  );
}

export function LibraryProblemsRetryAction({
  item,
}: {
  item: LibraryProblemView;
}) {
  const tSaved = useTranslations("library.saved");
  const canRetry = item.canRetry && item.question_no !== null;

  if (!canRetry) {
    return (
      <Button
        type="primary"
        size="small"
        disabled
        aria-label={tSaved("retryUnavailable")}
        title={tSaved("retryUnavailable")}
      >
        {tSaved("retry")}
      </Button>
    );
  }

  return (
    <Link
      href={
        writingProblemHref({
          questionNo: item.question_no,
          problemId: item.id,
        }) as never
      }
    >
      <Button type="primary" size="small">
        {tSaved("retry")}
      </Button>
    </Link>
  );
}
