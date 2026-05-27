"use client";

import { Card, Typography } from "antd";

const { Title, Paragraph } = Typography;

type Props = {
  emoji: string;
  title: string;
  description: string;
};

export function FeatureCard({ emoji, title, description }: Props) {
  return (
    <Card>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
      <Title level={4}>{title}</Title>
      <Paragraph>{description}</Paragraph>
    </Card>
  );
}
