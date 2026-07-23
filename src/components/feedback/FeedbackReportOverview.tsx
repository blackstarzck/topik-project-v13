"use client";

import { Button, Progress, Tag, Typography, theme } from "antd";
import Image from "next/image";
import { RotateCcw } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type {
  FeedbackDimensionScoreRow,
  SubmittedAnswerDisplayItem,
  WritingFeedbackRow,
  WritingSubmissionRow,
} from "@/lib/writing/types";
import {
  getSubmittedAnswerDisplayItems,
  isQuestionNo,
  isShortAnswer,
} from "@/lib/writing/types";
import type { ExternalFeedbackSupplement } from "@/lib/writing/external-feedback";

const { Text, Title } = Typography;

type OverviewScoreItem = {
  key: string;
  label: string;
  score: number | null;
  scoreMax: number | null;
  weightMax: number | null;
  summary: string | null;
  improvements: string[];
  answer: string | null;
};

type Props = {
  feedback: WritingFeedbackRow;
  submission: Pick<
    WritingSubmissionRow,
    "question_no" | "submitted_at" | "char_count" | "answer_text"
  >;
  dimensions: FeedbackDimensionScoreRow[];
  supplement: ExternalFeedbackSupplement;
  retryHref: string;
  retryLabel: string;
  retryDisabled?: boolean;
  retryDisabledReason?: string;
  showCardHeader?: boolean;
};

type ReportTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function FeedbackReportOverview({
  feedback,
  submission,
  dimensions,
  supplement,
  retryHref,
  retryLabel,
  retryDisabled = false,
  retryDisabledReason,
  showCardHeader = true,
}: Props) {
  const t = useTranslations("feedback.report") as ReportTranslator;
  const router = useRouter();
  const { token } = theme.useToken();
  const totalMax = feedback.score_max ?? 100;
  const raw = asRecord(feedback.raw_ai_result);
  const submittedAnswers =
    isQuestionNo(submission.question_no) &&
    isShortAnswer(submission.question_no) &&
    submission.answer_text
      ? getSubmittedAnswerDisplayItems(
          submission.question_no,
          submission.answer_text,
        )
      : [];
  const traitItems = readTraitScoreItems(raw, totalMax, submittedAnswers, t);
  const scoreItems =
    traitItems.length > 0 ? traitItems : readDimensionItems(dimensions, t);
  const focusAreas = supplement.learning.focusAreas.slice(0, 3);
  const recommendations = buildRecommendations(scoreItems, supplement, t);

  return (
    <>
      {showCardHeader ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span className="text-xl font-semibold text-text">
            {t("title", { questionNo: submission.question_no })}
          </span>
          <Button
            type="primary"
            icon={<RotateCcw aria-hidden size={16} />}
            onClick={() => {
              if (retryDisabled) return;
              router.push(retryHref);
            }}
            disabled={retryDisabled}
            title={retryDisabled ? retryDisabledReason : undefined}
          >
            {retryLabel}
          </Button>
        </div>
      ) : null}
      <section
        className="flex min-w-0 flex-col gap-3"
        data-testid="feedback-report-criteria-card"
      >
        <Title level={5} className="m-0">
          {t("criteriaTitle")}
        </Title>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {scoreItems.length > 0 ? (
            scoreItems.slice(0, 4).map((item) => {
              const score = item.score ?? null;
              const max = item.scoreMax ?? item.weightMax ?? totalMax;
              const percent =
                score !== null && max > 0
                  ? Math.max(0, Math.min(100, Math.round((score / max) * 100)))
                  : 0;
              return (
                <div
                  key={item.key}
                  className="flex min-w-0 flex-col gap-2 rounded-default bg-background p-3"
                  data-testid="feedback-report-score-item"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Text strong>{item.label}</Text>
                    <div className="flex flex-none flex-wrap justify-end gap-1">
                      <Tag>
                        {t("scoreValue", {
                          score: formatScoreValue(score),
                        })}
                      </Tag>
                      {item.weightMax !== null ? (
                        <Tag>
                          {t("weightScore", {
                            score: formatNumber(item.weightMax),
                          })}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  <Progress
                    percent={percent}
                    showInfo={false}
                    size="small"
                    strokeColor={token.colorText}
                  />
                  {item.answer ? (
                    <div className="flex min-w-0 flex-col gap-1">
                      <Text type="secondary" className="block text-xs">
                        {t("submittedAnswerLabel")}
                      </Text>
                      <Text className="block whitespace-pre-line break-words">
                        {item.answer}
                      </Text>
                    </div>
                  ) : null}
                  <Text
                    type="secondary"
                    className="block text-sm"
                    title={item.summary ?? undefined}
                  >
                    {item.summary ?? t("scoreSummaryFallback")}
                  </Text>
                </div>
              );
            })
          ) : (
            <Text type="secondary">{t("criteriaEmpty")}</Text>
          )}
        </div>
      </section>

      <section
        className="flex min-w-0 flex-col gap-3"
        data-testid="feedback-report-focus-card"
      >
        <div className="feedback-report-focus-title-row flex h-5 items-center gap-2">
          <Title level={5} className="!m-0 !flex !h-5 !items-center !leading-5">
            {t("focusTitle")}
          </Title>
          <span className="feedback-report-focus-title-icon-box inline-flex h-5 w-5 flex-none items-center justify-center">
            <Image
              src="/assets/star-brush.png?v=red-20260630"
              alt=""
              aria-hidden="true"
              width={20}
              height={20}
              unoptimized
              className="feedback-report-focus-title-icon block h-5 w-5 object-contain"
            />
          </span>
        </div>
        {focusAreas.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {focusAreas.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
        ) : (
          <Text type="secondary">{t("focusEmpty")}</Text>
        )}
        <div className="flex flex-col gap-2">
          {recommendations.map((item) => (
            <Text key={item} type="secondary" className="block text-sm">
              {item}
            </Text>
          ))}
        </div>
      </section>
    </>
  );
}

function readTraitScoreItems(
  raw: Record<string, unknown> | null,
  totalMax: number,
  submittedAnswers: SubmittedAnswerDisplayItem[],
  t: ReportTranslator,
): OverviewScoreItem[] {
  const traits = raw?.trait_scores;
  if (!Array.isArray(traits)) return [];

  return traits.flatMap((item, index) => {
    const record = asRecord(item);
    if (!record) return [];
    const trait = readString(record.trait) ?? readString(record.name);
    const score = readNumber(record.score);
    const rawMax = readNumber(record.max_score);
    const weight = readNumber(record.weight);
    const weightMax =
      weight === null
        ? null
        : weight > 0 && weight <= 1
          ? weight * totalMax
          : weight;
    const scoreMax = rawMax ?? weightMax;
    return [
      {
        key: trait ?? `trait-${index}`,
        label: traitLabel({
          trait,
          traitKorean: readString(record.trait_korean),
          index,
          t,
        }),
        score,
        scoreMax,
        weightMax,
        summary: readString(record.feedback) ?? readString(record.comment),
        improvements: readStringArray(record.improvements),
        answer: answerForTrait(trait, submittedAnswers),
      },
    ];
  });
}

function readDimensionItems(
  dimensions: FeedbackDimensionScoreRow[],
  t: ReportTranslator,
): OverviewScoreItem[] {
  return dimensions
    .filter((item) => item.score !== null || item.summary)
    .slice(0, 4)
    .map((item) => ({
      key: item.dimension,
      label: dimensionLabel(item.dimension, t),
      score: item.score,
      scoreMax: item.score_max,
      weightMax: item.score_max,
      summary: item.summary,
      improvements: [],
      answer: null,
    }));
}

function answerForTrait(
  trait: string | null,
  submittedAnswers: SubmittedAnswerDisplayItem[],
): string | null {
  const answerIndex = trait === "blank_1" ? 0 : trait === "blank_2" ? 1 : -1;
  return answerIndex >= 0
    ? (submittedAnswers[answerIndex]?.text ?? null)
    : null;
}

function buildRecommendations(
  scoreItems: OverviewScoreItem[],
  supplement: ExternalFeedbackSupplement,
  t: ReportTranslator,
): string[] {
  const items = [
    supplement.learning.studyTips,
    ...scoreItems.flatMap((item) => item.improvements),
    ...supplement.learning.focusAreas,
  ]
    .filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    )
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 2);

  return items.length > 0 ? items : [t("recommendationFallback")];
}

function traitLabel({
  trait,
  traitKorean,
  index,
  t,
}: {
  trait: string | null;
  traitKorean: string | null;
  index: number;
  t: ReportTranslator;
}): string {
  if (trait === "blank_1") return t("blank1Label");
  if (trait === "blank_2") return t("blank2Label");
  if (traitKorean) return traitKorean;
  if (trait) return trait;
  return t("genericCriteria", { index: index + 1 });
}

function dimensionLabel(
  dimension: FeedbackDimensionScoreRow["dimension"],
  t: ReportTranslator,
): string {
  switch (dimension) {
    case "grammar":
      return t("dimension.grammar");
    case "vocab":
      return t("dimension.vocab");
    case "structure":
      return t("dimension.structure");
    case "content":
      return t("dimension.content");
    case "expression":
      return t("dimension.expression");
    case "topic_fit":
      return t("dimension.topic_fit");
    case "language":
      return t("dimension.language");
  }
}

function formatScoreValue(score: number | null): string {
  return score === null ? "-" : formatNumber(score);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = readString(item);
    return text ? [text] : [];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
