"use client";

import type { ReactNode } from "react";
import { Alert, Button, Skeleton, Tag, Typography } from "antd";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  Clock3,
  Lightbulb,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AppCard } from "@/components/shared/AppCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { isValidQuestionNo, type QuestionNo } from "@/lib/practice/types";
import { writingQuestionHref } from "@/lib/writing/routes";
import { difficultyFillColor } from "./DifficultyMeter";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import {
  PrimaryRecommendationCard,
  SecondaryRecommendationCard,
} from "./RecommendationItemCards";
import { TypeSelectCards } from "./TypeSelectCards";
import { getReasonTagColor } from "./reason-tag-colors";
import { useRecommendationBundle } from "./recommendations-data";

const { Title, Text } = Typography;

const FALLBACK_META: Record<QuestionNo, { minutes: number }> = {
  51: { minutes: 15 },
  52: { minutes: 25 },
  53: { minutes: 30 },
  54: { minutes: 50 },
};

function RecommendationBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary";
}) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "primary"
          ? "border-primary bg-primary text-background"
          : "border-border bg-surface text-text-secondary",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function FallbackRecommendationPanel({
  questionNo,
  reasonSummary,
}: {
  questionNo: QuestionNo;
  reasonSummary?: string | null;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const typeLabel = tCommon(`questionType${questionNo}`);
  const questionLabel = tCommon("questionNo", { no: questionNo });
  const meta = FALLBACK_META[questionNo];

  return (
    <AppCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col justify-center gap-4">
          <RecommendationBadge tone="primary">
            {t("primaryBadge")}
          </RecommendationBadge>
          <h2 className="m-0 text-3xl font-semibold leading-tight text-text">
            {t("fallbackHeroTitle", { type: typeLabel })}
          </h2>
          <Text className="max-w-xl text-base leading-7" type="secondary">
            {reasonSummary ?? t("fallbackHeroBody", { type: typeLabel })}
          </Text>
        </div>
        <div className="self-center">
          <div className="grid gap-2 sm:grid-cols-3">
            <span className="flex min-w-0 items-center gap-3 rounded-default bg-surface p-3">
              <Clock3 size={18} aria-hidden="true" />
              <span className="grid min-w-0 gap-1">
                <small className="text-xs text-text-secondary">
                  {t("fallbackHeroTime")}
                </small>
                <strong className="truncate text-base text-text">
                  {tCommon("minutes", { minutes: meta.minutes })}
                </strong>
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-3 rounded-default bg-surface p-3">
              <ChartNoAxesColumnIncreasing
                size={18}
                aria-hidden="true"
                color={difficultyFillColor(3)}
              />
              <span className="grid min-w-0 gap-1">
                <small className="text-xs text-text-secondary">
                  {t("fallbackHeroDifficulty")}
                </small>
                <strong className="truncate text-base text-text">
                  {tCommon("difficultyNormal")}
                </strong>
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-3 rounded-default bg-surface p-3">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span className="grid min-w-0 gap-1">
                <small className="text-xs text-text-secondary">
                  {t("fallbackHeroStatus")}
                </small>
                <strong className="truncate text-base text-text">
                  {t("fallbackHeroStatusReady")}
                </strong>
              </span>
            </span>
          </div>
          <Link href={writingQuestionHref(questionNo) as never}>
            <Button className="mt-4" type="primary" size="large" block>
              <span>{t("fallbackHeroCta", { type: questionLabel })}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </AppCard>
  );
}

function RecommendationReasonSkeleton() {
  return (
    <div
      className="recommendation-reason-card__skeleton"
      data-testid="recommendation-reason-skeleton"
    >
      <Skeleton.Button
        className="recommendation-reason-card__skeleton-line"
        size="small"
        block
      />
      <div className="recommendation-reason-card__skeleton-tags">
        <Skeleton.Button
          className="recommendation-reason-card__skeleton-tag"
          size="small"
          shape="round"
        />
        <Skeleton.Button
          className="recommendation-reason-card__skeleton-tag"
          size="small"
          shape="round"
        />
        <Skeleton.Button
          className="recommendation-reason-card__skeleton-tag"
          size="small"
          shape="round"
        />
      </div>
    </div>
  );
}

function RecommendationReasonPanel({
  questionNo,
  reasonSummary,
  weaknessTags,
  isLoading,
  animationKey,
}: {
  questionNo: QuestionNo;
  reasonSummary?: string | null;
  weaknessTags: string[];
  isLoading: boolean;
  animationKey: string;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const typeLabel = tCommon(`questionType${questionNo}`);
  const tags =
    weaknessTags.length > 0
      ? weaknessTags
      : [
          t("reasonTagGrammar"),
          t("reasonTagStructure"),
          t("reasonTagExpression"),
        ];

  return (
    <AppCard>
      <section
        className={[
          "recommendation-reason-card",
          // Stagger only the real content. The skeleton stays static — animating a
          // placeholder reads as jank. The panel's `key` remounts on the
          // loading→ready flip, so the loaded content still animates in once.
          isLoading ? null : "recommendation-reason-card--stagger",
        ]
          .filter(Boolean)
          .join(" ")}
        data-animation-key={animationKey}
      >
        <div className="recommendation-reason-card__icon" aria-hidden="true">
          <Lightbulb size={24} strokeWidth={1.7} />
        </div>
        <div className="recommendation-reason-card__body">
          <Text className="recommendation-reason-card__title" strong>
            {t("reasonSummaryTitle")}
          </Text>
          {isLoading ? (
            <RecommendationReasonSkeleton />
          ) : (
            <>
              <Text
                className="recommendation-reason-card__copy"
                type="secondary"
              >
                {reasonSummary ??
                  t("reasonSummaryFallback", { type: typeLabel })}
              </Text>
              <div className="recommendation-reason-card__footer">
                <div className="recommendation-reason-card__tags">
                  {tags.map((tag, index) => (
                    <Tag
                      className="recommendation-reason-card__tag"
                      color={getReasonTagColor(index, tags.length)}
                      key={`${tag}-${index}`}
                      variant="filled"
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </AppCard>
  );
}

function RecommendationResultsSkeleton() {
  return (
    <div
      className="recommendation-results-skeleton"
      data-testid="recommendation-results-skeleton"
      aria-busy="true"
    >
      <AppCard className="h-full">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid min-w-0 content-center gap-4">
            <Skeleton.Button
              className="recommendation-results-skeleton__badge"
              size="small"
              shape="round"
            />
            <Skeleton
              title={{ width: "58%" }}
              paragraph={{ rows: 1, width: ["72%"] }}
            />
          </div>
          <div className="grid gap-4 self-center">
            <div className="grid gap-2 sm:grid-cols-3">
              <Skeleton.Button size="large" block />
              <Skeleton.Button size="large" block />
              <Skeleton.Button size="large" block />
            </div>
            <Skeleton.Button size="large" block />
          </div>
        </div>
      </AppCard>

      <section className="grid gap-3">
        <Skeleton.Button
          className="recommendation-results-skeleton__section-title"
          size="small"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <AppCard size="small">
            <Skeleton title={{ width: "42%" }} paragraph={{ rows: 2 }} />
          </AppCard>
          <AppCard size="small">
            <Skeleton title={{ width: "46%" }} paragraph={{ rows: 2 }} />
          </AppCard>
        </div>
      </section>
    </div>
  );
}

export function RecommendationsView() {
  const t = useTranslations("practice.recommendations");
  const router = useRouter();
  const params = useSearchParams();

  const active = useMemo<QuestionNo | null>(() => {
    const raw = params.get("type");
    if (!raw) return null;
    const parsed = Number(raw);
    return isValidQuestionNo(parsed) ? parsed : null;
  }, [params]);

  const bundle = useRecommendationBundle(active);

  function updateType(next: QuestionNo | null) {
    const search = new URLSearchParams(params.toString());
    if (next == null) search.delete("type");
    else search.set("type", String(next));
    router.replace(
      `/practice/recommendations${search.size ? `?${search.toString()}` : ""}` as never,
    );
  }

  const items = bundle.data?.items ?? [];
  const primary = items[0] ?? null;
  const rest = items.slice(1);
  const fallbackQuestionNo = active ?? primary?.questionNo ?? 51;
  const recommendedQuestionNo = primary?.questionNo ?? fallbackQuestionNo;
  const reasonSummary = bundle.data?.run?.reasonSummary ?? primary?.reason;

  // The stagger replays whenever this key changes the panel's React `key`,
  // remounting it. Derive it from the content actually shown — the selected
  // type and its load state — NOT from the tab click. A click-driven counter
  // bumped the key before the URL→active→bundle update landed, so the panel
  // remounted against the previous tab's still-current data: the old tags
  // staggered in, then the new tab's tags staggered in a second time.
  const reasonAnimationKey = `${active ?? "auto"}-${
    bundle.isLoading ? "loading" : "ready"
  }`;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        className="mb-1"
        title={t("heading")}
        subtitle={t("subtitle")}
      />

      <div className="grid gap-4">
        <ProblemTypeTabs active={active} onChange={updateType} />
        <RecommendationReasonPanel
          key={`reason-${reasonAnimationKey}`}
          questionNo={recommendedQuestionNo}
          reasonSummary={reasonSummary}
          weaknessTags={primary?.weaknessTags ?? []}
          isLoading={bundle.isLoading}
          animationKey={reasonAnimationKey}
        />
      </div>

      {bundle.isLoading ? (
        <>
          <RecommendationResultsSkeleton />
          <TypeSelectCards />
        </>
      ) : bundle.error ? (
        <>
          <Alert
            className="rounded-default"
            type="error"
            showIcon
            title={t("loadErrorTitle")}
            description={t("loadErrorDescription")}
            action={
              <Button size="small" onClick={() => bundle.refetch()}>
                {t("retry")}
              </Button>
            }
          />
          <TypeSelectCards />
        </>
      ) : items.length > 0 ? (
        <>
          {primary ? <PrimaryRecommendationCard card={primary} /> : null}

          {rest.length > 0 ? (
            <section className="grid gap-3">
              <Title className="m-0" level={4}>
                {t("otherRecommendations")}
              </Title>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {rest.map((card) => (
                  <div key={card.itemId} className="min-w-0">
                    <SecondaryRecommendationCard card={card} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <TypeSelectCards />
        </>
      ) : (
        <>
          <FallbackRecommendationPanel
            questionNo={fallbackQuestionNo}
            reasonSummary={bundle.data?.run?.reasonSummary}
          />
          <TypeSelectCards />
          <div className="flex flex-col items-start gap-2 pt-2 sm:flex-row sm:items-center sm:gap-3">
            <Text type="secondary">{t("emptyDescription")}</Text>
            <Link
              className="inline-flex items-center text-sm font-semibold text-text underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={"/practice/problems" as never}
            >
              {t("viewProblemList")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
