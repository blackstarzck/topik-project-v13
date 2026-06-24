"use client";

import { Button, Progress, Tag, Typography, theme } from "antd";
import { CalendarDays, Clock3, RotateCcw } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type {
  FeedbackDimensionScoreRow,
  WritingFeedbackRow,
  WritingSubmissionRow,
} from "@/lib/writing/types";
import type { ExternalFeedbackSupplement } from "@/lib/writing/external-feedback";

const { Text } = Typography;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type OverviewScoreItem = {
  key: string;
  label: string;
  score: number | null;
  scoreMax: number | null;
  weightMax: number | null;
  summary: string | null;
  improvements: string[];
};

type Props = {
  feedback: WritingFeedbackRow;
  submission: Pick<
    WritingSubmissionRow,
    "question_no" | "submitted_at" | "char_count"
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
  const totalScore = feedback.score_total ?? null;
  const totalMax = feedback.score_max ?? 100;
  const raw = asRecord(feedback.raw_ai_result);
  const traitItems = readTraitScoreItems(raw, totalMax, t);
  const scoreItems =
    traitItems.length > 0 ? traitItems : readDimensionItems(dimensions, t);
  const submittedAt = submission.submitted_at
    ? formatSubmittedAtKst(submission.submitted_at)
    : null;
  const processingSeconds = readNumber(raw?.processing_time_seconds);
  const durationSeconds =
    readNumber(raw?.time_spent_seconds) ??
    readNumber(raw?.time_spent) ??
    readNumber(raw?.duration_seconds);
  const focusAreas = supplement.learning.focusAreas.slice(0, 3);
  const recommendations = buildRecommendations(scoreItems, supplement, t);

  return (
    <section
      data-testid="feedback-report-overview"
      className="feedback-report-overview"
    >
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
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-end">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 md:justify-end"
            data-testid="feedback-report-meta"
          >
            {submittedAt ? (
              <span
                className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-text-secondary"
                data-testid="feedback-report-meta-item"
              >
                <CalendarDays aria-hidden size={14} />
                {t("submittedAt", { submittedAt })}
              </span>
            ) : null}
            {durationSeconds !== null ? (
              <span
                className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-text-secondary"
                data-testid="feedback-report-meta-item"
              >
                <Clock3 aria-hidden size={14} />
                {t("duration", {
                  duration: formatDuration(durationSeconds, t),
                })}
              </span>
            ) : processingSeconds !== null ? (
              <span
                className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-text-secondary"
                data-testid="feedback-report-meta-item"
              >
                <Clock3 aria-hidden size={14} />
                {t("analysisTime", {
                  seconds: formatNumber(processingSeconds),
                })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.7fr)_minmax(240px,0.9fr)]">
          <section
            className="rounded-default bg-surface/40 p-4"
            data-testid="feedback-report-total-score-card"
          >
            <Text type="secondary" className="block text-sm">
              {t("scoreTitle")}
            </Text>
            <div
              className="mt-2 flex items-end gap-1 text-text"
              data-testid="feedback-report-total-score-line"
            >
              <span
                className="text-4xl font-bold leading-none"
                data-testid="feedback-report-total-score-value"
              >
                {formatScoreValue(totalScore)}
              </span>
              <span
                className="pb-0.5 text-base font-semibold leading-none"
                data-testid="feedback-report-total-score-suffix"
              >
                {t("scoreSuffix", { max: formatNumber(totalMax) })}
              </span>
            </div>
            <Text type="secondary" className="mt-2 block">
              {scoreStatusLabel(totalScore, totalMax, t)}
            </Text>
          </section>

          <section
            className="flex min-w-0 flex-col gap-3 rounded-default bg-surface/40 p-4"
            data-testid="feedback-report-criteria-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text strong>{t("criteriaTitle")}</Text>
              <Text type="secondary" className="text-xs">
                {t("criteriaHint")}
              </Text>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {scoreItems.length > 0 ? (
                scoreItems.slice(0, 4).map((item) => {
                  const score = item.score ?? null;
                  const max = item.scoreMax ?? item.weightMax ?? totalMax;
                  const percent =
                    score !== null && max > 0
                      ? Math.max(
                          0,
                          Math.min(100, Math.round((score / max) * 100)),
                        )
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
                      <Text
                        type="secondary"
                        className="line-clamp-2 text-sm"
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
            className="flex min-w-0 flex-col gap-3 rounded-default bg-surface/40 p-4"
            data-testid="feedback-report-focus-card"
          >
            <Text strong>{t("focusTitle")}</Text>
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
        </div>
      </div>
    </section>
  );
}

function readTraitScoreItems(
  raw: Record<string, unknown> | null,
  totalMax: number,
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
    }));
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
  }
}

function scoreStatusLabel(
  score: number | null,
  max: number,
  t: ReportTranslator,
): string {
  if (score === null || max <= 0) return t("scorePending");
  const rate = score / max;
  if (rate >= 0.8) return t("scoreStrong");
  if (rate >= 0.6) return t("scoreReview");
  return t("scoreNeedsPractice");
}

function formatSubmittedAtKst(value: string): string | null {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const date = new Date(time + KST_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function formatScoreValue(score: number | null): string {
  return score === null ? "-" : formatNumber(score);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDuration(value: number, t: ReportTranslator): string {
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return t("durationSeconds", { seconds });
  if (seconds === 0) return t("durationMinutes", { minutes });
  return t("durationMinutesSeconds", { minutes, seconds });
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
