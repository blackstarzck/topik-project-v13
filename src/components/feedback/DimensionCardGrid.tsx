import { Card, Col, Row, Tag, Typography } from "antd";
import {
  FEEDBACK_DIMENSIONS,
  type FeedbackDimensionKey,
  type FeedbackDimensionScoreRow,
} from "@/lib/writing/types";

const { Text } = Typography;

const LABELS: Record<FeedbackDimensionKey, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합도",
};

type Props = { rows: FeedbackDimensionScoreRow[] };

export function DimensionCardGrid({ rows }: Props) {
  const byDim = new Map(rows.map((r) => [r.dimension, r] as const));
  return (
    <Row gutter={[12, 12]}>
      {FEEDBACK_DIMENSIONS.map((dim) => {
        const row = byDim.get(dim);
        const score = row?.score ?? null;
        const tone = score === null ? "default" : score >= 80 ? "green" : score >= 65 ? "gold" : "red";
        return (
          <Col key={dim} xs={24} md={12} lg={8}>
            <Card
              size="small"
              style={score === null ? { opacity: 0.55 } : undefined}
            >
              <Text strong>{LABELS[dim]}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={tone}>{score ?? "—"} / {row?.score_max ?? 100}</Tag>
              </div>
              <Text type="secondary">{row?.summary ?? "분석 대기 중"}</Text>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
