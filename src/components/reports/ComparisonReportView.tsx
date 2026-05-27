import { Card, Space, Typography } from "antd";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";
import { MetricsTable } from "./MetricsTable";
import { SubmissionDiffPanel } from "./SubmissionDiffPanel";

const { Paragraph, Title } = Typography;

type Props = {
  metrics: ComparisonMetrics;
  narrative: string | null;
  currentText: string;
  previousText: string | null;
};

export function ComparisonReportView({
  metrics,
  narrative,
  currentText,
  previousText,
}: Props) {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card>
        <Title level={4} style={{ marginTop: 0 }}>비교 리포트</Title>
        <Paragraph>{narrative ?? "—"}</Paragraph>
      </Card>
      <MetricsTable metrics={metrics} />
      <SubmissionDiffPanel
        currentText={currentText}
        previousText={previousText}
      />
    </Space>
  );
}
