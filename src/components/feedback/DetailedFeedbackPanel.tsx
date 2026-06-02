"use client";

import { Card, Collapse, Empty, Progress, Space, Tag, Typography } from "antd";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Paragraph, Text } = Typography;

/**
 * E-02 상세 피드백 패널이 다루는 5개 세부 항목 (description region 3):
 * 구조, 논리, 어휘, 문법, 주제 적합성. weakness_level/score로 세부 평가를 보여준다.
 * 제약: 평가 항목 5개 이하.
 */
const DETAIL_DIMENSIONS: {
  key: FeedbackDimensionScoreRow["dimension"];
  label: string;
}[] = [
  { key: "structure", label: "구조" },
  { key: "content", label: "논리" },
  { key: "vocab", label: "어휘" },
  { key: "grammar", label: "문법" },
  { key: "topic_fit", label: "주제 적합성" },
];

type Props = {
  dimensions: FeedbackDimensionScoreRow[];
};

/**
 * E-02 상세 피드백 패널 (description region 3).
 * 제약: 평가 항목 5개 이하, 각 항목 본문 2줄 우선.
 * 예외: 추천 없음/항목 누락은 빈 상태와 보완 안내 표시.
 */
export function DetailedFeedbackPanel({ dimensions }: Props) {
  const byDim = new Map(dimensions.map((d) => [d.dimension, d] as const));
  const available = DETAIL_DIMENSIONS.filter((d) => byDim.has(d.key));

  if (available.length === 0) {
    return (
      <Card title="상세 피드백">
        <Empty description="세부 평가가 아직 준비되지 않았어요. 다시 분석하면 항목별 상세 평가를 볼 수 있어요." />
      </Card>
    );
  }

  const items = available.map((d) => {
    const row = byDim.get(d.key);
    const score = row?.score ?? null;
    const max = row?.score_max ?? 100;
    const percent = score !== null ? Math.round((score / max) * 100) : 0;
    return {
      key: d.key,
      label: (
        <Space>
          <Text strong>{d.label}</Text>
          <Tag color={score === null ? "default" : percent < 60 ? "red" : "blue"}>
            {score ?? "—"} / {max}
          </Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {score !== null ? (
            <Progress
              percent={percent}
              showInfo={false}
              status={percent < 60 ? "exception" : "normal"}
            />
          ) : null}
          {/* 각 항목 본문 2줄 우선 (description region 3 제약). */}
          <Paragraph
            type="secondary"
            style={{ marginBottom: 0 }}
            ellipsis={{ rows: 2, expandable: true, symbol: "더보기" }}
          >
            {row?.summary ??
              "이 항목의 상세 평가가 비어 있어요. 다음 답안에서 더 자세한 평가를 받을 수 있어요."}
          </Paragraph>
        </Space>
      ),
    };
  });

  return (
    <Card title="상세 피드백" styles={{ body: { paddingTop: 0 } }}>
      <Collapse
        ghost
        items={items}
        defaultActiveKey={available.length > 0 ? [available[0].key] : []}
      />
    </Card>
  );
}
