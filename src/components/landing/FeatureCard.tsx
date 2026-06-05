"use client";

import { Typography } from "antd";

import { AppCard } from "@/components/shared/AppCard";

const { Title, Paragraph } = Typography;

type Props = {
  emoji: string;
  title: string;
  description: string;
};

export function FeatureCard({ emoji, title, description }: Props) {
  return (
    <AppCard>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
      <Title level={4}>{title}</Title>
      <Paragraph>{description}</Paragraph>
    </AppCard>
  );
}
