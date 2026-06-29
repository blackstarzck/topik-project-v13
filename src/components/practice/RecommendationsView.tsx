"use client";

import { Alert, Button, Empty, Skeleton, Tag, Typography } from "antd";
import { Lightbulb } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AppCard } from "@/components/shared/AppCard";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  isValidQuestionNo,
  QUESTION_NOS,
  type QuestionNo,
} from "@/lib/practice/types";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import {
  PrimaryRecommendationCard,
  SecondaryRecommendationCard,
} from "./RecommendationItemCards";
import { TypeSelectCards } from "./TypeSelectCards";
import { getReasonTagColor } from "./reason-tag-colors";
import { useRecommendationBundle } from "./recommendations-data";
import { useWritingAvailability } from "./writing-availability-data";

const { Title, Text } = Typography;

/**
 * Honest empty state — shown when the live recommendation query returns zero
 * items. It must NOT fabricate a personalized recommendation (no "대표 추천"
 * hero, no "이렇게 추천했어요" analysis). It states plainly that there is nothing
 * to recommend yet and points users to the type-select cards / problem list so
 * they can start practicing.
 */
function RecommendationEmptyState() {
  const t = useTranslations("practice.recommendations");

  return (
    <AppCard>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span className="text-text-secondary">{t("emptyDescription")}</span>
        }
      >
        <Link href={"/practice/problems" as never}>
          <Button type="primary">{t("viewProblemList")}</Button>
        </Link>
      </Empty>
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
  const writingAvailability = useWritingAvailability();
  const lockedTypes =
    writingAvailability.data?.lockedTypes ?? new Set<QuestionNo>(QUESTION_NOS);
  const retry = useSingleFlightAction(() => bundle.refetch());

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

  // The reason panel explains WHY a problem was recommended. With no
  // recommendations there is nothing to explain — rendering a fabricated
  // "이렇게 추천했어요" analysis (fallback summary + default weakness tags) would
  // misrepresent an empty state as a personalized result. So it only shows
  // while loading or when real items exist; the empty state stays honest.
  const showReasonPanel = bundle.isLoading || items.length > 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        className="mb-1"
        title={t("heading")}
        subtitle={t("subtitle")}
      />

      <div className="grid gap-4">
        <ProblemTypeTabs
          active={active}
          onChange={updateType}
          lockedTypes={lockedTypes}
        />
        {showReasonPanel ? (
          <RecommendationReasonPanel
            key={`reason-${reasonAnimationKey}`}
            questionNo={recommendedQuestionNo}
            reasonSummary={reasonSummary}
            weaknessTags={primary?.weaknessTags ?? []}
            isLoading={bundle.isLoading}
            animationKey={reasonAnimationKey}
          />
        ) : null}
      </div>

      {bundle.isLoading ? (
        <>
          <RecommendationResultsSkeleton />
          <TypeSelectCards lockedTypes={lockedTypes} />
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
              <Button
                size="small"
                loading={retry.pending}
                disabled={retry.pending}
                onClick={() => void retry.run()}
              >
                {t("retry")}
              </Button>
            }
          />
          <TypeSelectCards lockedTypes={lockedTypes} />
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

          <TypeSelectCards lockedTypes={lockedTypes} />
        </>
      ) : (
        <>
          <RecommendationEmptyState />
          <TypeSelectCards lockedTypes={lockedTypes} />
        </>
      )}
    </div>
  );
}
