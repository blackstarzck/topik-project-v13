"use client";

import type { KeyboardEvent } from "react";
import { Button, Col, Empty, Row, Space, Tag, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/shared/AppCard";
import { writingProblemHref } from "@/lib/writing/routes";
import { SPACING } from "@/theme/spacing";

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

function difficultyKey(difficulty: number | null | undefined): string | null {
  if (difficulty == null) return null;
  if (difficulty <= 1) return "difficultyVeryEasy";
  if (difficulty === 2) return "difficultyEasy";
  if (difficulty === 3) return "difficultyNormal";
  if (difficulty === 4) return "difficultyHardish";
  return "difficultyHard";
}

function truncateTitle(title: string) {
  return title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT)}...` : title;
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
  const { token } = theme.useToken();
  const router = useRouter();

  if (alternatives.length === 0) {
    return (
      <section data-testid="next-alternatives">
        <Title level={5}>{t("alternativesTitle")}</Title>
        <Empty description={t("alternativesEmpty")} />
      </section>
    );
  }

  const selectedStyle = {
    borderColor: token.colorPrimary,
    borderWidth: token.lineWidth * 2,
  };

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
                  style={{
                    opacity: token.opacityLoading,
                    background: token.colorBgContainerDisabled,
                  }}
                  title={
                    <Tag color="default">
                      {alternative.questionNo != null
                        ? tCommon("questionNo", { no: alternative.questionNo })
                        : alternative.domain}
                    </Tag>
                  }
                >
                  <Space
                    orientation="vertical"
                    size="small"
                    style={{ width: "100%" }}
                  >
                    <Text type="secondary">{t("lockedNotice")}</Text>
                    <Button
                      size="small"
                      onClick={() => router.push("/paywall" as never)}
                    >
                      {t("upgradeInfo")}
                    </Button>
                  </Space>
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
                style={selectedId === alternative.id ? selectedStyle : undefined}
                title={
                  <Space wrap>
                    <Tag color="default">
                      {alternative.questionNo != null
                        ? tCommon("questionNo", { no: alternative.questionNo })
                        : alternative.domain}
                    </Tag>
                    {diffLabel ? <Tag color="purple">{diffLabel}</Tag> : null}
                    {alternative.estimatedMinutes != null ? (
                      <Tag color="cyan">
                        {tCommon("minutes", {
                          minutes: alternative.estimatedMinutes,
                        })}
                      </Tag>
                    ) : null}
                  </Space>
                }
              >
                <Text strong>{truncateTitle(alternative.title)}</Text>
                {alternative.reason ? (
                  <div style={{ marginTop: SPACING.xs }}>
                    <Paragraph
                      type="secondary"
                      style={{ fontSize: token.fontSizeSM, margin: 0 }}
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
