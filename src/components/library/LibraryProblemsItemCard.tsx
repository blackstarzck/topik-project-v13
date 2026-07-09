"use client";

/**
 * F-01 `/library/problems` 카드 뷰 렌더러.
 * 표지 이미지가 없는 데이터라 문제 번호 + 제목 + 요약 중심으로
 * 구성한다. 링크/배지/불가 처리 규칙은 리스트 행(LibraryProblemsRows)과
 * 동일하고, 다시 풀기 액션은 LibraryProblemsRetryAction을 공유한다.
 */

import { Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  clampTitle,
  type SubmissionEnrichment,
} from "@/components/library/library-enrich-data";
import { AppCard } from "@/components/shared/AppCard";
import { writingFeedbackHref } from "@/lib/writing/routes";

import { LibraryProblemsActionMenu } from "./LibraryProblemsActionMenu";
import { LibraryProblemsQuestionNumber } from "./LibraryProblemsQuestionNumber";
import {
  LibraryProblemsDraftAction,
  LibraryProblemsRetryAction,
} from "./LibraryProblemsRows";
import {
  draftTitle,
  isAnalysisPendingStatus,
  problemTitle,
  submissionTitle,
  type LibraryListTranslate,
  type MixedLibraryProblemItem,
} from "./library-problems-presenter";

const { Paragraph, Text } = Typography;

type Props = {
  entry: MixedLibraryProblemItem;
  meta: SubmissionEnrichment | undefined;
};

function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
    </div>
  );
}

export function LibraryProblemsItemCard({ entry, meta }: Props) {
  const tSubmissions = useTranslations(
    "library.submissions",
  ) as LibraryListTranslate;
  const t = useTranslations("library.problemsList") as LibraryListTranslate;
  const tSaved = useTranslations("library.saved") as LibraryListTranslate;

  if (entry.kind === "submission") {
    const item = entry.item;
    const feedbackStatus = meta?.feedbackStatus ?? "pending";
    const analysisPending = isAnalysisPendingStatus(feedbackStatus);
    const actionMenuAvailable = feedbackStatus === "complete";
    const fallbackTitle = tSubmissions("problemTitle", {
      id: item.problem_id.slice(0, 8),
    });
    const title = submissionTitle(item, fallbackTitle);

    return (
      <AppCard className="h-full">
        <div className="flex h-full flex-col gap-2">
          <div className="flex justify-end">
            <LibraryProblemsQuestionNumber questionNo={item.question_no} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          {meta?.summary ? (
            <Paragraph className="mb-0" ellipsis={{ rows: 2 }} type="secondary">
              {meta.summary}
            </Paragraph>
          ) : analysisPending ? (
            <Paragraph className="mb-0" ellipsis={{ rows: 2 }} type="secondary">
              {tSubmissions("analysisPendingHint")}
            </Paragraph>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="flex flex-wrap items-center gap-2">
              <TagChips tags={item.tags} />
            </span>
            {actionMenuAvailable ? (
              <LibraryProblemsActionMenu item={item} />
            ) : null}
          </div>
        </div>
      </AppCard>
    );
  }

  if (entry.kind === "draft") {
    const item = entry.item;
    const fallbackTitle = tSubmissions("problemTitle", {
      id: item.problem_id.slice(0, 8),
    });
    const title = draftTitle(item, fallbackTitle);

    return (
      <AppCard className="h-full">
        <div className="flex h-full flex-col gap-2">
          <div className="flex justify-end">
            <LibraryProblemsQuestionNumber questionNo={item.question_no} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag data-testid="library-problems-type-badge">
              {t("typeDraft")}
            </Tag>
          </div>
          <Text strong>{clampTitle(title)}</Text>
          {item.answer_text ? (
            <Paragraph className="mb-0" ellipsis={{ rows: 2 }} type="secondary">
              {item.answer_text}
            </Paragraph>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-2">
            <LibraryProblemsDraftAction item={item} />
          </div>
        </div>
      </AppCard>
    );
  }

  const item = entry.item;
  const unavailable = item.availabilityStatus !== "available";
  const title = problemTitle(item.title, tSaved("unavailablePlaceholderTitle"));

  return (
    <AppCard className={unavailable ? "h-full opacity-40" : "h-full"}>
      <div className="flex h-full flex-col gap-2">
        <div className="flex justify-end">
          <LibraryProblemsQuestionNumber questionNo={item.question_no} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unavailable ? (
            <Tag data-testid="library-problem-unavailable-badge">
              {item.availabilityStatus === "soft_unavailable"
                ? tSaved("providedEnded")
                : tSaved("unavailable")}
            </Tag>
          ) : null}
        </div>
        <Text strong>{title}</Text>
        {unavailable ? (
          <Text
            data-testid="library-problem-unavailable-reason"
            type="secondary"
          >
            {item.availabilityReason ?? tSaved("unavailableDefaultReason")}
          </Text>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <TagChips tags={item.tags} />
          <LibraryProblemsRetryAction item={item} />
        </div>
      </div>
    </AppCard>
  );
}
