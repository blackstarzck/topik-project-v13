import { Card, Col, Empty, Row, Typography } from "antd";

const { Paragraph, Title } = Typography;

type Props = {
  currentText: string;
  previousText: string | null;
};

export function SubmissionDiffPanel({ currentText, previousText }: Props) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={12}>
        <Card size="small">
          <Title level={5}>이번 답안</Title>
          <Paragraph style={{ whiteSpace: "pre-line" }}>
            {currentText || "—"}
          </Paragraph>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small">
          <Title level={5}>이전 답안</Title>
          {previousText ? (
            <Paragraph style={{ whiteSpace: "pre-line" }}>
              {previousText}
            </Paragraph>
          ) : (
            <Empty description="이전 답안 없음" />
          )}
        </Card>
      </Col>
    </Row>
  );
}
