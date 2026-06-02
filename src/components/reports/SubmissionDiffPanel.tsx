"use client";

import { Card, Col, Empty, Row, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Paragraph, Title } = Typography;

type Props = {
  currentText: string;
  previousText: string | null;
};

export function SubmissionDiffPanel({ currentText, previousText }: Props) {
  const t = useTranslations("reports.diff");
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={12}>
        <Card size="small">
          <Title level={5}>{t("currentAnswer")}</Title>
          <Paragraph style={{ whiteSpace: "pre-line" }}>
            {currentText || "—"}
          </Paragraph>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small">
          <Title level={5}>{t("previousAnswer")}</Title>
          {previousText ? (
            <Paragraph style={{ whiteSpace: "pre-line" }}>
              {previousText}
            </Paragraph>
          ) : (
            <Empty description={t("noPreviousAnswer")} />
          )}
        </Card>
      </Col>
    </Row>
  );
}
