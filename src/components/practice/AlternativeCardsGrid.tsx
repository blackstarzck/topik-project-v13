"use client";

import type { KeyboardEvent } from "react";
import { Button, Col, Empty, Row, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { writingProblemHref } from "@/lib/writing/routes";
import { SPACING } from "@/theme/spacing";
import { difficultyKey } from "./difficulty";

const { Paragraph, Text, Title } = Typography;
const TITLE_LIMIT = 28;

type AlternativeProblem = {
  id: string;
  title: string;
  questionNo: number | null;
  domain: string;
  reason: string | null;
  estimatedMinutes?: number | null;
  difficulty?: number | null;
  locked?: boolean;
};

type Props = {
  alternatives: AlternativeProblem[];
  selectedId?: string | null;
  onSelect?: (alt: AlternativeProblem) => void;
};

function truncateTitle(title: string) {
  return title.length > TITLE_LIMIT
    ? `${title.slice(0, TITLE_LIMIT)}...`
    : title;
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLElement>,
  callback: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  callback();
}

export function AlternativeCardsGrid({
  alternatives,
  selectedId,
  onSelect,
}: Props) {
  const t = useTranslations("practice.next");
  const tCommon = useTranslations("practice.common");
  const router = useRouter();

  if (alternatives.length === 0) {
    return (
      <section data-testid="next-alternatives">
        <Title level={5}>{t("alternativesTitle")}</Title>
        <Empty description={t("alternativesEmpty")} />
      </section>
    );
  }

  return (
    <section data-testid="next-alternatives">
      <Title level={5}>{t("alternativesTitle")}</Title>
      <Row gutter={[SPACING.md, SPACING.md]}>
        {alternatives.slice(0, 3).map((alternative) => {
          const diffKey = difficultyKey(alternative.difficulty);
          const diffLabel = diffKey
            ? tCommon(diffKey as Parameters<typeof tCommon>[0])
            : null;

          if (alternative.locked) {
            return (
              <Col key={alternative.id} xs={24} md={8}>
                <AppCard
                  data-testid="next-alternative-locked"
                  data-problem-id={alternative.id}
                  className="bg-surface opacity-60"
                  title={
                    <Tag>
                      {alternative.questionNo != null
                        ? tCommon("questionNo", { no: alternative.questionNo })
                        : alternative.domain}
                    </Tag>
                  }
                >
                  <div className="flex w-full flex-col gap-2">
                    <Text type="secondary">{t("lockedNotice")}</Text>
                    <Button
                      size="small"
                      onClick={() => router.push("/paywall" as never)}
                    >
                      {t("upgradeInfo")}
                    </Button>
                  </div>
                </AppCard>
              </Col>
            );
          }

          const handleClick = () => {
            if (onSelect) {
              onSelect(alternative);
              return;
            }
            router.push(
              writingProblemHref({
                questionNo: alternative.questionNo,
                problemId: alternative.id,
              }) as never,
            );
          };

          return (
            <Col key={alternative.id} xs={24} md={8}>
              <AppCard
                hoverable
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={(event) => handleCardKeyDown(event, handleClick)}
                data-testid="next-alternative-card"
                data-problem-id={alternative.id}
                className={
                  selectedId === alternative.id
                    ? "ring-2 ring-primary"
                    : undefined
                }
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag>
                      {alternative.questionNo != null
                        ? tCommon("questionNo", { no: alternative.questionNo })
                        : alternative.domain}
                    </Tag>
                    {diffLabel ? <Tag>{diffLabel}</Tag> : null}
                    {alternative.estimatedMinutes != null ? (
                      <Tag>
                        {tCommon("minutes", {
                          minutes: alternative.estimatedMinutes,
                        })}
                      </Tag>
                    ) : null}
                  </div>
                }
              >
                <Text strong>{truncateTitle(alternative.title)}</Text>
                {alternative.reason ? (
                  <div className="mt-1">
                    <Paragraph
                      type="secondary"
                      className="mb-0 text-xs"
                      ellipsis={{ rows: 2 }}
                    >
                      {alternative.reason}
                    </Paragraph>
                  </div>
                ) : null}
              </AppCard>
            </Col>
          );
        })}
      </Row>
    </section>
  );
}
