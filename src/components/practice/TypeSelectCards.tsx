"use client";

import type { ReactNode } from "react";
import { Tooltip, Typography } from "antd";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  PencilLine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { QUESTION_NOS, type QuestionNo } from "@/lib/practice/types";
import { writingQuestionHref } from "@/lib/writing/routes";

const { Text, Title } = Typography;

const TYPE_META: Record<
  QuestionNo,
  {
    minutes: number;
    difficultyKey: "difficultyNormal" | "difficultyHardish" | "difficultyHard";
    tone: "violet" | "blue" | "green" | "coral";
    icon: ReactNode;
  }
> = {
  51: {
    minutes: 15,
    difficultyKey: "difficultyNormal",
    tone: "violet",
    icon: <PencilLine size={28} />,
  },
  52: {
    minutes: 25,
    difficultyKey: "difficultyHardish",
    tone: "blue",
    icon: <FileText size={28} />,
  },
  53: {
    minutes: 30,
    difficultyKey: "difficultyHard",
    tone: "green",
    icon: <BarChart3 size={28} />,
  },
  54: {
    minutes: 50,
    difficultyKey: "difficultyHard",
    tone: "coral",
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
    <section className="recommendation-type-section">
      <div className="recommendation-type-section__heading">
        <Title level={4}>{t("typeSelectTitle")}</Title>
        <Text type="secondary">{t("typeSelectSubtitle")}</Text>
      </div>
      <div className="recommendation-type-grid">
        {QUESTION_NOS.map((qn) => {
          const locked = lockedTypes?.has(qn) ?? false;
          const typeLabel = tCommon(`questionType${qn}`);
          const desc = t(`typeDescription${qn}`);
          const meta = TYPE_META[qn];
          const card = (
            <span
              className={[
                "recommendation-type-card",
                `is-${meta.tone}`,
                locked ? "is-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="recommendation-type-card__topline">
                <span className="recommendation-type-card__badge">
                  {tCommon("questionNo", { no: qn })}
                </span>
                {locked ? (
                  <span className="recommendation-type-card__locked">
                    {t("locked")}
                  </span>
                ) : null}
              </span>
              <span className="recommendation-type-card__icon">
                {meta.icon}
              </span>
              <strong>{typeLabel}</strong>
              <Text type="secondary">
                {desc.length > 60 ? `${desc.slice(0, 60)}...` : desc}
              </Text>
              <span className="recommendation-type-card__meta">
                <span>
                  <Clock3 size={14} />
                  {tCommon("minutes", { minutes: meta.minutes })}
                </span>
                <span>
                  <CheckCircle2 size={14} />
                  {tCommon(meta.difficultyKey)}
                </span>
              </span>
              <span className="recommendation-type-card__cta">
                {t("typeCardCta")}
              </span>
            </span>
          );
          return locked ? (
            <Tooltip key={qn} title={t("typeLockedTooltip")}>
              <span aria-disabled="true" className="recommendation-type-link">
                {card}
              </span>
            </Tooltip>
          ) : (
            <Link
              key={qn}
              href={writingQuestionHref(qn) as never}
              className="recommendation-type-link"
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
