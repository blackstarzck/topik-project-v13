"use client";

import type { ReactNode } from "react";
import { Tooltip, Typography } from "antd";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  PencilLine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AppCard } from "@/components/shared/AppCard";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";
import { writingQuestionHref } from "@/lib/writing/routes";

const { Text, Title } = Typography;

const TYPE_META: Record<
  QuestionNo,
  {
    minutes: number;
    difficultyKey: "difficultyNormal" | "difficultyHardish" | "difficultyHard";
    icon: ReactNode;
  }
> = {
  51: {
    minutes: 15,
    difficultyKey: "difficultyNormal",
    icon: <PencilLine size={28} />,
  },
  52: {
    minutes: 25,
    difficultyKey: "difficultyHardish",
    icon: <FileText size={28} />,
  },
  53: {
    minutes: 30,
    difficultyKey: "difficultyHard",
    icon: <BarChart3 size={28} />,
  },
  54: {
    minutes: 50,
    difficultyKey: "difficultyHard",
    icon: <ListChecks size={28} />,
  },
};

type Props = {
  lockedTypes?: Set<QuestionNo>;
};

export function TypeSelectCards({ lockedTypes }: Props) {
  const t = useTranslations("practice.recommendations");
  const tCommon = useTranslations("practice.common");
  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <Title className="m-0" level={4}>
          {t("typeSelectTitle")}
        </Title>
        <Text type="secondary">{t("typeSelectSubtitle")}</Text>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {QUESTION_NOS.map((qn) => {
          const locked = lockedTypes?.has(qn) ?? false;
          const typeLabel = tCommon(`questionType${qn}`);
          const desc = t(`typeDescription${qn}`);
          const meta = TYPE_META[qn];
          const card = (
            <AppCard
              className={[
                "h-full transition-transform",
                locked ? "opacity-60" : "hover:-translate-y-1",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="rounded-default bg-surface px-3 py-1 text-xs font-semibold text-text">
                  {tCommon("questionNo", { no: qn })}
                </span>
                {locked ? (
                  <span className="rounded-default bg-surface px-3 py-1 text-xs text-text-secondary">
                    {t("locked")}
                  </span>
                ) : null}
              </span>
              <span
                className="mt-5 inline-flex size-12 items-center justify-center rounded-default border border-border bg-surface text-text"
                aria-hidden="true"
              >
                {meta.icon}
              </span>
              <strong className="mt-4 block text-lg text-text">
                {typeLabel}
              </strong>
              <Text className="mt-2 block min-h-12" type="secondary">
                {desc.length > 60 ? `${desc.slice(0, 60)}...` : desc}
              </Text>
              <span className="mt-5 flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={14} />
                  {tCommon("minutes", { minutes: meta.minutes })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  {tCommon(meta.difficultyKey)}
                </span>
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-text">
                {t("typeCardCta")}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </AppCard>
          );
          return locked ? (
            <Tooltip key={qn} title={t("typeLockedTooltip")}>
              <span aria-disabled="true" className="block h-full">
                {card}
              </span>
            </Tooltip>
          ) : (
            <Link
              key={qn}
              href={writingQuestionHref(qn) as never}
              className="block h-full text-inherit no-underline"
              aria-label={t("typeStartAria", { type: typeLabel })}
            >
              {card}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
