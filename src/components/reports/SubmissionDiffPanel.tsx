"use client";

import { Col, Empty, Row, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import { SPACING } from "@/theme/spacing";

const { Paragraph, Title } = Typography;
const EMPTY_ANSWER = "-";

type Props = {
  currentText: string;
  previousText: string | null;
};

export function SubmissionDiffPanel({ currentText, previousText }: Props) {
  const t = useTranslations("reports.diff");
  return (
    <Row gutter={[SPACING.md, SPACING.md]} data-testid="comparison-submission-diff">
      <Col xs={24} md={12}>
        <AppCard size="small">
          <Title level={5} className="comparison-card-title">
            {t("currentAnswer")}
          </Title>
          <Paragraph className="comparison-preline">
            {currentText || EMPTY_ANSWER}
          </Paragraph>
        </AppCard>
      </Col>
      <Col xs={24} md={12}>
        <AppCard size="small">
          <Title level={5} className="comparison-card-title">
            {t("previousAnswer")}
          </Title>
          {previousText ? (
            <Paragraph className="comparison-preline">
              {previousText}
            </Paragraph>
          ) : (
            <Empty description={t("noPreviousAnswer")} />
          )}
        </AppCard>
      </Col>
    </Row>
  );
}
