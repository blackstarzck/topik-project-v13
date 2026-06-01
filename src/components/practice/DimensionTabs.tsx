"use client";

import { Card, Empty, Progress, Tabs, Tag, Typography } from "antd";

const { Text, Paragraph } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

type WeakDimension = {
  dimension: string;
  averageScore: number;
  sampleCount?: number;
};

type Props = {
  dimensions: WeakDimension[];
};

/**
 * Phase 7-D Task 7 (P1-3) — X-07 dimension tabs.
 * IA spec: docs/Wireframe/29-X-07-weakness-based-recommendations/description.md.
 * 각 차원 진행 상태 + 평균 점수 + 데이터 부족 시 안내.
 */
export function DimensionTabs({ dimensions }: Props) {
  if (dimensions.length === 0) {
    return (
      <Card>
        <Empty description="평가된 차원이 아직 없습니다. 글쓰기를 제출하면 차원별 점수가 누적됩니다." />
      </Card>
    );
  }

  const items = dimensions.map((d) => {
    const label = DIMENSION_LABELS[d.dimension] ?? d.dimension;
    const intStatus =
      d.averageScore >= 70
        ? "success"
        : d.averageScore >= 50
          ? "normal"
          : "exception";

    return {
      key: d.dimension,
      label,
      children: (
        <Card>
          <Progress
            percent={Math.round(d.averageScore)}
            status={intStatus}
            format={(p) => `${p}점`}
          />
          <Paragraph style={{ marginTop: 12 }}>
            <Text strong>{label}</Text> 평균 점수{" "}
            <Tag color={intStatus === "exception" ? "red" : "blue"}>
              {Math.round(d.averageScore)}점
            </Tag>
            {d.sampleCount != null ? (
              <Text type="secondary"> · {d.sampleCount}개 표본</Text>
            ) : null}
          </Paragraph>
        </Card>
      ),
    };
  });

  return <Tabs items={items} />;
}
