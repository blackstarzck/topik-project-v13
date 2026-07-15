"use client";

import type { ReactNode } from "react";
import { Button, Typography } from "antd";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  Clock3,
} from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppCard } from "@/components/shared/AppCard";
import { writingProblemHref } from "@/lib/writing/routes";
import { difficultyFillColor } from "./DifficultyMeter";
import type { RecommendationItemCard } from "./recommendations-data";

const { Paragraph, Text, Title } = Typography;

const DEFAULT_MINUTES_BY_QUESTION: Record<number, number> = {
  51: 15,
  52: 25,
  53: 30,
  54: 50,
};

const secondaryCardClassNames = {
  body: "flex-1",
  actions: "app-card-footer-actions [&>li]:!px-3 [&>li]:!pb-3",
};

function ctaHref(card: RecommendationItemCard, returnTo: string): string {
  return writingProblemHref({
    questionNo: card.questionNo,
    problemId: card.problemId,
    returnTo,
  });
}

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

function RecommendationMetaTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3 rounded-default bg-surface p-3">
      {icon}
      <span className="grid min-w-0 gap-1">
        <small className="text-xs text-text-secondary">{label}</small>
        <strong className="truncate text-base text-text">{value}</strong>
      </span>
    </span>
  );
}

/**
 * weakness_tags hold raw feedback dimension keys (grammar, vocab, …). Known
 * dimensions render as locale labels; anything else (future/custom tags)
 * passes through untouched.
 */
const WEAKNESS_DIMENSION_TAGS = new Set([
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
  "language",
]);

export function weaknessTagLabel(
  t: ReturnType<typeof useTranslations<"practice.recommendations">>,
  tag: string,
): string {
  return WEAKNESS_DIMENSION_TAGS.has(tag)
    ? t(`dimension.${tag}` as Parameters<typeof t>[0])
    : tag;
}

/** C-01 §3 — 취약 태그 근거 (recommendation_items.weakness_tags). */
function WeaknessTags({ tags }: { tags: string[] }) {
  const t = useTranslations("practice.recommendations");
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Text className="text-xs" type="secondary">
        {t("weaknessTagsLabel")}
      </Text>
      {tags.slice(0, 4).map((tag) => (
        <RecommendationBadge key={tag}>
          {weaknessTagLabel(t, tag)}
        </RecommendationBadge>
      ))}
    </div>
  );
}

/**
 * C-01 §3 — 대표 추천 1개를 크게 노출. 제목 32자, 추천 사유 2줄 이하.
 */
export function PrimaryRecommendationCard({
  card,
  returnTo,
}: {
  card: RecommendationItemCard;
  returnTo: string;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const title =
    card.title.length > 32 ? `${card.title.slice(0, 32)}…` : card.title;
  const minutes =
    card.estimatedMinutes ??
    (card.questionNo != null
      ? DEFAULT_MINUTES_BY_QUESTION[card.questionNo]
      : null);
  return (
    <AppCard className="h-full">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col justify-center gap-4">
          <RecommendationBadge tone="primary">
            {t("primaryBadge")}
          </RecommendationBadge>
          <Title className="m-0 text-3xl font-semibold leading-tight" level={2}>
            {title}
          </Title>
          {card.reason ? (
            <Paragraph
              className="m-0 max-w-xl text-base leading-7"
              type="secondary"
              ellipsis={{ rows: 2 }}
            >
              {card.reason}
            </Paragraph>
          ) : null}
        </div>
        <div className="self-center">
          <div className="grid gap-2 sm:grid-cols-3">
            <RecommendationMetaTile
              icon={<Clock3 size={18} aria-hidden="true" />}
              label={t("fallbackHeroTime")}
              value={minutes != null ? tCommon("minutes", { minutes }) : "—"}
            />
            <RecommendationMetaTile
              icon={
                <ChartNoAxesColumnIncreasing
                  size={18}
                  aria-hidden="true"
                  color={difficultyFillColor(3)}
                />
              }
              label={t("fallbackHeroDifficulty")}
              value={tCommon("difficultyNormal")}
            />
            <RecommendationMetaTile
              icon={<CheckCircle2 size={18} aria-hidden="true" />}
              label={t("fallbackHeroStatus")}
              value={t("fallbackHeroStatusReady")}
            />
          </div>
          <Link href={ctaHref(card, returnTo) as never}>
            <Button className="mt-4" type="primary" size="large" block>
              {t("startFromThis")}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </AppCard>
  );
}

/** 대표 추천 외 나머지 추천(compact). */
export function SecondaryRecommendationCard({
  card,
  returnTo,
}: {
  card: RecommendationItemCard;
  returnTo: string;
}) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  const title =
    card.title.length > 32 ? `${card.title.slice(0, 32)}…` : card.title;
  return (
    <AppCard
      className="flex h-full flex-col"
      classNames={secondaryCardClassNames}
      actions={[
        <Link
          key="continue"
          href={ctaHref(card, returnTo) as never}
          className="block w-full"
        >
          <Button
            className="inline-flex items-center justify-center gap-2"
            block
          >
            {t("continueProblem")}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </Link>,
      ]}
      size="small"
      title={
        card.questionNo
          ? tCommon("questionNo", { no: card.questionNo })
          : t("recommendationFallback")
      }
      extra={
        card.estimatedMinutes ? (
          <RecommendationBadge>
            {tCommon("minutes", { minutes: card.estimatedMinutes })}
          </RecommendationBadge>
        ) : null
      }
    >
      <Text strong>{title}</Text>
      {card.reason ? (
        <Paragraph className="mt-2" type="secondary" ellipsis={{ rows: 2 }}>
          {card.reason}
        </Paragraph>
      ) : null}
      <WeaknessTags tags={card.weaknessTags} />
    </AppCard>
  );
}
