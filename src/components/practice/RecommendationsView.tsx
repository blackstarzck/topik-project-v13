"use client";

import type { ReactNode } from "react";
import { Alert, Button, Spin, Typography } from "antd";
import { ArrowRight, CheckCircle2, Clock3, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { AppCard } from "@/components/shared/AppCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { isValidQuestionNo, type QuestionNo } from "@/lib/practice/types";
import { writingQuestionHref } from "@/lib/writing/routes";
import { ProblemTypeTabs } from "./ProblemTypeTabs";
import {
  PrimaryRecommendationCard,
  SecondaryRecommendationCard,
} from "./RecommendationItemCards";
import { TypeSelectCards } from "./TypeSelectCards";
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
              <Target size={18} aria-hidden="true" />
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

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        className="mb-1"
        title={t("heading")}
        subtitle={t("subtitle")}
      />

      <div className="overflow-hidden rounded-3xl border border-border bg-background px-3 pt-2">
        <ProblemTypeTabs active={active} onChange={updateType} />
      </div>

      {bundle.data?.run?.reasonSummary && primary ? (
        <Alert
          className="rounded-default"
          type="info"
          showIcon
          title={t("reasonSummaryTitle")}
          description={bundle.data.run.reasonSummary}
        />
      ) : null}

      {bundle.isLoading ? (
        <Spin description={t("loadingTip")}>
          <div className="min-h-32" />
        </Spin>
      ) : bundle.error ? (
        <>
          <Alert
            className="rounded-default"
            type="error"
            showIcon
            title={t("loadErrorTitle")}
            description={
              bundle.error instanceof Error ? bundle.error.message : ""
            }
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
              <div className="grid gap-3 md:grid-cols-2">
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
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border pt-2">
            <Text type="secondary">{t("emptyDescription")}</Text>
            <Link href={"/practice/problems" as never}>
              <Button>{t("viewProblemList")}</Button>
            </Link>
          </div>
        </>
      )}

      <Text className="block text-xs" type="secondary">
        {t("footerNote")}
      </Text>
    </div>
  );
}
