"use client";

import { Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import type { ExternalFeedbackSupplement } from "@/lib/writing/external-feedback";

const { Paragraph, Text, Title } = Typography;

type Props = {
  supplement: ExternalFeedbackSupplement;
};

type FeedbackExternalTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function ExternalLearningFeedbackCard({ supplement }: Props) {
  const t = useTranslations("feedback.external") as FeedbackExternalTranslator;
  const learning = supplement.learning;
  if (!supplement.hasLearning) return null;

  return (
    <AppCard data-testid="external-learning-feedback">
      <Title level={5} className="mt-0">
        {t("learningTitle")}
      </Title>
      <Paragraph type="secondary" className="mb-3">
        {t("learningIntro")}
      </Paragraph>

      <div className="flex w-full flex-col gap-4">
        {learning.focusAreas.length > 0 ? (
          <section className="flex flex-col gap-2">
            <Text strong>{t("focusAreas")}</Text>
            <Space size={[6, 6]} wrap>
              {learning.focusAreas.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </Space>
          </section>
        ) : null}

        {learning.studyTips ? (
          <section className="flex flex-col gap-1">
            <Text strong>{t("studyTips")}</Text>
            <Paragraph type="secondary" className="mb-0">
              {learning.studyTips}
            </Paragraph>
          </section>
        ) : null}

        {learning.grammarPoints.length > 0 ? (
          <section className="flex flex-col gap-2">
            <Text strong>{t("grammarPoints")}</Text>
            <div className="flex flex-col gap-2">
              {learning.grammarPoints.map((point) => (
                <div
                  key={`${point.grammar}-${point.explanation}-${point.example}`}
                  className="rounded-md border border-solid border-gray-200 p-3"
                >
                  {point.grammar ? <Text strong>{point.grammar}</Text> : null}
                  {point.explanation ? (
                    <Paragraph type="secondary" className="mb-1 mt-1">
                      {point.explanation}
                    </Paragraph>
                  ) : null}
                  {point.example ? (
                    <Text type="secondary" className="text-xs">
                      {point.example}
                    </Text>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {learning.vocabulary.length > 0 ? (
          <section className="flex flex-col gap-2">
            <Text strong>{t("vocabulary")}</Text>
            <Space size={[6, 6]} wrap>
              {learning.vocabulary.map((word) => (
                <Tag key={word}>{word}</Tag>
              ))}
            </Space>
          </section>
        ) : null}

        {learning.exercises.length > 0 ? (
          <section className="flex flex-col gap-2">
            <Text strong>{t("exercises")}</Text>
            <div className="flex flex-col gap-3">
              {learning.exercises.map((exercise) => (
                <div
                  key={`${exercise.exerciseType}-${exercise.question}-${exercise.answer}`}
                  className="rounded-md border border-solid border-gray-200 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {exercise.exerciseType ? (
                      <Tag>{exercise.exerciseType}</Tag>
                    ) : null}
                    {exercise.targetErrorType ? (
                      <Tag>{exercise.targetErrorType}</Tag>
                    ) : null}
                  </div>
                  {exercise.question ? (
                    <Paragraph className="mb-1 mt-2">
                      {exercise.question}
                    </Paragraph>
                  ) : null}
                  {exercise.answer ? (
                    <Text type="secondary" className="block">
                      {t("exerciseAnswer", { answer: exercise.answer })}
                    </Text>
                  ) : null}
                  {exercise.explanation ? (
                    <Text type="secondary" className="block">
                      {t("exerciseExplanation", {
                        explanation: exercise.explanation,
                      })}
                    </Text>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppCard>
  );
}
