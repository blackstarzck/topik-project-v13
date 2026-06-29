"use client";

import { Empty, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";

const { Paragraph, Text, Title } = Typography;
const EMPTY_ANSWER = "-";

type Props = {
  currentText: string;
  previousText: string | null;
};

export function SubmissionDiffPanel({ currentText, previousText }: Props) {
  const t = useTranslations("reports.diff");
  return (
    <AppCard
      title={t("title")}
      data-testid="comparison-submission-diff"
      className="comparison-diff-panel"
    >
      <div className="grid overflow-hidden rounded-lg border border-border md:grid-cols-2">
        <section className="min-w-0 border-b border-border md:border-b-0 md:border-r">
          <div className="border-b border-border bg-[var(--app-color-bg-layout)] px-4 py-3">
            <Title level={5} className="m-0">
              {t("currentAnswer")}
            </Title>
          </div>
          <Paragraph className="m-0 whitespace-pre-line p-4">
            {currentText || EMPTY_ANSWER}
          </Paragraph>
        </section>
        <section className="min-w-0">
          <div className="border-b border-border bg-[var(--app-color-bg-layout)] px-4 py-3">
            <Title level={5} className="m-0">
              {t("previousAnswer")}
            </Title>
          </div>
          {previousText ? (
            <Paragraph className="m-0 whitespace-pre-line p-4">
              {previousText}
            </Paragraph>
          ) : (
            <div className="p-4">
              <Empty description={t("noPreviousAnswer")} />
            </div>
          )}
        </section>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <Text type="secondary" className="text-xs">
          {t("added")}
        </Text>
        <Text type="secondary" className="text-xs">
          {t("removed")}
        </Text>
        <Text type="secondary" className="text-xs">
          {t("changed")}
        </Text>
      </div>
    </AppCard>
  );
}
