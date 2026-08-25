"use client";

import { Button, Tag, Tooltip, Typography } from "antd";
import { useTranslations } from "next-intl";

import { ArrowRight, Clock3, MagicPen } from "@/components/shared/AppIcons";
import { AppCard } from "@/components/shared/AppCard";
import {
  DifficultyStateIcon,
  difficultyLabelKey,
} from "@/components/practice/DifficultyMeter";
import type { LibraryReviewCandidate } from "@/lib/library/types";

import { formatDashboardDate } from "./library-dashboard-format";
import { LibraryReviewQuestionNumber } from "./LibraryReviewQuestionNumber";
import typographyStyles from "./LibraryTypography.module.css";

const { Text } = Typography;

type Props = {
  candidate: LibraryReviewCandidate;
};

export function LibraryReviewCandidateCard({ candidate }: Props) {
  const t = useTranslations("library.dashboard");
  const tCommon = useTranslations("practice.common");
  const primaryReason = t(
    `reason.${candidate.primaryReason}` as Parameters<typeof t>[0],
  );
  const estimatedTime =
    candidate.estimatedMinutes != null
      ? tCommon("minutes", { minutes: candidate.estimatedMinutes })
      : null;
  const difficulty =
    candidate.difficultyLevel != null
      ? tCommon(
          difficultyLabelKey(candidate.difficultyLevel) as Parameters<
            typeof tCommon
          >[0],
        )
      : null;
  const totalScore =
    candidate.scoreTotal != null
      ? t("meta.totalScore", { score: candidate.scoreTotal })
      : t("meta.totalScoreUnavailable");
  const scoreTooltip =
    candidate.scoreTotal != null && candidate.scoreMax != null
      ? t("meta.totalScoreTooltip", {
          score: candidate.scoreTotal,
          max: candidate.scoreMax,
        })
      : t("meta.totalScoreUnavailable");
  return (
    <AppCard
      size="small"
      data-testid="library-review-candidate-card"
      className="library-review-candidate-card flex h-full"
      classNames={{ body: "flex h-full w-full" }}
    >
      <article
        data-testid="library-review-candidate-shell"
        className="flex h-[300px] min-h-[300px] w-full flex-col"
      >
        <section
          data-testid="library-review-candidate-top"
          className="flex flex-1 flex-col justify-between"
        >
          <div
            data-testid="library-review-candidate-heading"
            className="grid min-w-0 gap-2"
          >
            <div
              data-testid="library-review-candidate-question-row"
              className="flex justify-end"
            >
              <LibraryReviewQuestionNumber questionNo={candidate.questionNo} />
            </div>

            <div
              data-testid="library-review-candidate-content"
              className="min-w-0"
            >
              <Tag
                data-testid="library-review-candidate-date"
                className="mb-2 ml-0 mr-0 text-sm"
              >
                <span className="sr-only">{t("meta.submittedAt")} </span>
                {formatDashboardDate(candidate.submittedAt)}
              </Tag>
              <strong
                data-testid="library-review-candidate-title"
                className="block truncate text-base font-semibold leading-normal text-text"
              >
                {candidate.title}
              </strong>
            </div>
          </div>

          <div
            data-testid="library-review-candidate-meta-group"
            className="mt-auto grid gap-2 pt-8 text-sm"
          >
            <Text
              type="secondary"
              data-testid="library-review-candidate-summary"
              className={`block ${typographyStyles.metadata}`}
            >
              {primaryReason}
              {" \u00b7 "}
              {t("charCount", { count: candidate.charCount })}
            </Text>
            <Text
              type="secondary"
              data-testid="library-review-candidate-total-score"
              className={`block ${typographyStyles.metadata}`}
            >
              {totalScore}
            </Text>
            {estimatedTime ? (
              <Text
                type="secondary"
                data-testid="library-review-candidate-estimated-time"
                className={`inline-flex items-center gap-2 ${typographyStyles.metadata}`}
              >
                <Clock3 size={16} aria-hidden="true" />
                <span>{estimatedTime}</span>
              </Text>
            ) : null}
            {difficulty && candidate.difficultyLevel != null ? (
              <Text
                type="secondary"
                data-testid="library-review-candidate-difficulty"
                className={`inline-flex items-center gap-2 ${typographyStyles.metadata}`}
              >
                <DifficultyStateIcon
                  level={candidate.difficultyLevel}
                  testId="library-review-candidate-difficulty-icon"
                />
                <span>{difficulty}</span>
              </Text>
            ) : null}
          </div>
        </section>

        <div className="-mx-3 mt-3 h-[3px]">
          <Tooltip title={scoreTooltip}>
            <progress
              data-testid="library-review-candidate-progress"
              className="library-review-candidate-score-progress block h-[3px] w-full"
              value={candidate.scorePercent ?? 0}
              max={100}
              aria-label={scoreTooltip}
            />
          </Tooltip>
        </div>

        <div
          data-testid="library-review-candidate-footer"
          className="-mb-3 -mx-3 grid grid-cols-[auto_1fr] gap-2 bg-surface px-3 py-3"
        >
          <Button
            type="primary"
            href={candidate.feedbackHref}
            aria-label={t("actions.viewFeedback")}
            title={t("actions.viewFeedback")}
            icon={<MagicPen size={16} aria-hidden="true" />}
            className="size-8 min-w-8 p-0"
          />
          {candidate.retryHref ? (
            <Button
              block
              href={candidate.retryHref}
              icon={<ArrowRight size={14} />}
              iconPlacement="end"
            >
              {t("actions.retry")}
            </Button>
          ) : (
            <Button block disabled>
              {t("actions.retryUnavailable")}
            </Button>
          )}
        </div>
      </article>
    </AppCard>
  );
}
