"use client";

import { Card, Empty, Space, Typography } from "antd";

const { Text, Paragraph } = Typography;

export type HelpCard = { title: string; body: string };

type Props = { cards?: HelpCard[] };

export function HelpPanel({ cards }: Props) {
  if (!cards || cards.length === 0) {
    return (
      <Card size="small">
        <Empty description="작성 팁이 곧 제공됩니다." />
      </Card>
    );
  }
  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {cards.slice(0, 3).map((c, i) => (
        <Card key={i} size="small">
          <Text strong>{c.title.slice(0, 16)}</Text>
          <Paragraph style={{ margin: 0 }} type="secondary">
            {c.body}
          </Paragraph>
        </Card>
      ))}
    </Space>
  );
}
