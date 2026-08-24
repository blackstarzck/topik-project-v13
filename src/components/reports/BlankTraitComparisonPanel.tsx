"use client";

import { Empty, Progress, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import { CheckCircle2 } from "@/components/shared/AppIcons";
import type {
  BlankComparisonDatum,
  BlankComparisonKey,
  ComparisonScoreItem,
} from "@/lib/writing/comparison-score-items";

const { Paragraph, Text } = Typography;
const EMPTY_VALUE = "-";
const CURRENT_COLUMN_CLASS = "lg:col-start-1";
const PREVIOUS_COLUMN_CLASS = "lg:col-start-2";

type ReportTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;
type AnswerFeedbackPlacement = "current" | "previous";

type Props = {
  items: BlankComparisonDatum[];
  hasPrevious: boolean;
  hasTraitData: boolean;
};

export function BlankTraitComparisonPanel({
  items,
  hasPrevious,
  hasTraitData,
}: Props) {
  const t = useTranslations("reports.blankComparison");
  const tx: ReportTranslator = (key, values) =>
    t(key as never, values as never);
  const { token } = theme.useToken();

  if (!hasTraitData) {
    return (
      <section className="min-w-0" data-testid="comparison-blank-trait-panel">
        <div
          className="!mb-[40px]"
          data-testid="comparison-blank-section-header"
        >
          <Text strong className="block text-base">
            {t("title")}
          </Text>
        </div>
        <Empty description={t("empty")} />
      </section>
    );
  }

  return (
    <section className="min-w-0" data-testid="comparison-blank-trait-panel">
      <div className="!mb-[40px]" data-testid="comparison-blank-section-header">
        <div className="min-w-0">
          <Text strong className="block text-base">
            {t("title")}
          </Text>
          <Text type="secondary" className="mt-2 block">
            {t("description")}
          </Text>
        </div>
      </div>
      <div className="grid gap-10">
        {items.map((item) => (
          <BlankTraitCard
            key={item.key}
            item={item}
            hasPrevious={hasPrevious}
            currentAccentColor={token.colorPrimary}
            previousAccentColor={token.colorTextQuaternary}
            t={tx}
          />
        ))}
      </div>
    </section>
  );
}

function BlankTraitCard({
  item,
  hasPrevious,
  currentAccentColor,
  previousAccentColor,
  t,
}: {
  item: BlankComparisonDatum;
  hasPrevious: boolean;
  currentAccentColor: string;
  previousAccentColor: string;
  t: ReportTranslator;
}) {
  return (
    <section
      className="min-w-0"
      data-testid="comparison-blank-trait-row"
      data-blank-key={item.key}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Text strong className="block text-base">
            {blankLabel(item.key, t)}
          </Text>
        </div>
      </div>

      <div
        className={classNames(
          "mt-4 grid gap-3",
          hasPrevious && "lg:grid-cols-2",
        )}
        data-testid="comparison-blank-score-area"
      >
        <div
          className="min-w-0"
          data-testid="comparison-blank-score-area-content"
        >
          <ScoreMeterRow
            title={t("currentAnswer")}
            item={item.current}
            accentColor={currentAccentColor}
            testId="comparison-blank-score-current"
            t={t}
          />
          {hasPrevious ? (
            <ScoreMeterRow
              title={t("previousAnswer")}
              item={item.previous}
              accentColor={previousAccentColor}
              testId="comparison-blank-score-previous"
              t={t}
            />
          ) : null}
        </div>
      </div>

      {!hasPrevious ? (
        <div className="pt-2">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("noPrevious")}
          />
        </div>
      ) : null}

      <div
        className={classNames(
          "mt-6 grid gap-3",
          hasPrevious && "lg:grid-cols-2",
        )}
      >
        <AnswerFeedbackGroup
          testId="comparison-blank-answer-feedback-current"
          placement="current"
          answerTitle={t("currentAnswer")}
          answer={item.currentAnswer}
          feedbackTitle={t("currentFeedback")}
          item={item.current}
          t={t}
        />
        {hasPrevious ? (
          <AnswerFeedbackGroup
            testId="comparison-blank-answer-feedback-previous"
            placement="previous"
            answerTitle={t("previousAnswer")}
            answer={item.previousAnswer}
            feedbackTitle={t("previousFeedback")}
            item={item.previous}
            t={t}
          />
        ) : null}
      </div>
    </section>
  );
}

function AnswerFeedbackGroup({
  testId,
  placement,
  answerTitle,
  answer,
  feedbackTitle,
  item,
  t,
}: {
  testId: string;
  placement: AnswerFeedbackPlacement;
  answerTitle: string;
  answer: string | null;
  feedbackTitle: string;
  item: ComparisonScoreItem | null;
  t: ReportTranslator;
}) {
  const columnClass =
    placement === "previous" ? PREVIOUS_COLUMN_CLASS : CURRENT_COLUMN_CLASS;

  return (
    <AppCard
      className={classNames("h-full min-w-0", columnClass)}
      data-testid={testId}
      size="small"
    >
      <div className="grid h-full grid-rows-[auto_1fr] gap-3">
        <AnswerTextBlock
          title={answerTitle}
          answer={answer}
          testId={`${testId}-answer`}
          labelTestId={`${testId}-answer-label`}
          className="h-full"
        />
        <FeedbackBlock
          title={feedbackTitle}
          item={item}
          t={t}
          testId={`${testId}-feedback`}
          labelTestId={`${testId}-feedback-label`}
          supportListTestId={`${testId}-feedback-support-list`}
          className="h-full"
        />
      </div>
    </AppCard>
  );
}

function ScoreMeterRow({
  title,
  item,
  accentColor,
  testId,
  className,
  t,
}: {
  title: string;
  item: ComparisonScoreItem | null;
  accentColor: string;
  testId: string;
  className?: string;
  t: ReportTranslator;
}) {
  const percent = item?.normalizedScore ?? 0;

  return (
    <div
      className={classNames(
        "grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-1 sm:grid-cols-[4.5rem_minmax(7rem,1fr)_max-content]",
        className,
      )}
      data-testid="comparison-blank-score-row"
    >
      <div className="contents" data-testid={testId}>
        <Text
          type="secondary"
          className="block text-xs font-medium"
          data-testid="comparison-blank-score-label"
        >
          {title}
        </Text>
        <Progress
          className="min-w-0 sm:order-none"
          percent={percent}
          showInfo={false}
          size="small"
          strokeColor={accentColor}
        />
        <div
          className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-baseline justify-end gap-x-1 text-right sm:col-start-auto sm:row-start-auto sm:min-w-[8.5rem]"
          data-testid="comparison-blank-score-value"
        >
          <Text strong className="whitespace-nowrap text-sm">
            {formatRawScore(item, t)}
          </Text>
          <Text
            type="secondary"
            className="whitespace-nowrap !text-[14px]"
            data-testid="comparison-blank-score-normalized"
          >
            ({formatNormalizedScore(item, t)})
          </Text>
        </div>
      </div>
    </div>
  );
}

function AnswerTextBlock({
  title,
  answer,
  testId,
  labelTestId,
  className,
}: {
  title: string;
  answer: string | null;
  testId: string;
  labelTestId: string;
  className?: string;
}) {
  return (
    <div className={classNames("min-w-0", className)} data-testid={testId}>
      <Text
        type="secondary"
        className="mb-1 block !text-[14px]"
        data-testid={labelTestId}
      >
        {title}
      </Text>
      <Paragraph className="m-0 whitespace-pre-wrap break-words text-sm">
        {answer ?? EMPTY_VALUE}
      </Paragraph>
    </div>
  );
}

function FeedbackBlock({
  title,
  item,
  t,
  testId,
  labelTestId,
  supportListTestId,
  className,
}: {
  title: string;
  item: ComparisonScoreItem | null;
  t: ReportTranslator;
  testId: string;
  labelTestId: string;
  supportListTestId: string;
  className?: string;
}) {
  const feedback = item?.summary ?? null;
  const supportItems = [
    ...(item?.strengths ?? []),
    ...(item?.improvements ?? []),
  ]
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className={classNames("min-w-0", className)} data-testid={testId}>
      <Text
        type="secondary"
        className="mb-1 block !text-[14px]"
        data-testid={labelTestId}
      >
        {title}
      </Text>
      <Paragraph className="m-0 whitespace-pre-wrap break-words text-sm">
        {feedback ?? t("feedbackEmpty")}
      </Paragraph>
      {supportItems.length > 0 ? (
        <ul
          className="mb-0 mt-2 flex list-none flex-col gap-1 pl-0 text-sm text-text-secondary"
          data-testid={supportListTestId}
        >
          {supportItems.map((supportItem) => (
            <li key={supportItem} className="flex items-start gap-2">
              <CheckCircle2
                aria-hidden
                className="mt-0.5 shrink-0 text-text-secondary"
                data-testid={`${supportListTestId.replace(
                  "support-list",
                  "support-icon",
                )}`}
                size={16}
              />
              <span className="min-w-0">{supportItem}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function blankLabel(key: BlankComparisonKey, t: ReportTranslator): string {
  return key === "blank_1" ? t("blank1") : t("blank2");
}

function formatRawScore(
  item: ComparisonScoreItem | null,
  t: ReportTranslator,
): string {
  if (!item || item.rawScore === null) return t("noScore");
  if (item.scoreMax === null) return t("scoreOnly", { score: item.rawScore });
  return t("scoreWithMax", { score: item.rawScore, max: item.scoreMax });
}

function formatNormalizedScore(
  item: ComparisonScoreItem | null,
  t: ReportTranslator,
): string {
  if (!item || item.normalizedScore === null) return t("normalizedUnavailable");
  return t("normalizedScore", { score: item.normalizedScore });
}
