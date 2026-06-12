"use client";

import { Card, Space, Tag, Typography } from "antd";

const { Title, Paragraph } = Typography;

type Props = {
  iaCode: string;
  title: string;
  phaseHint: string;
};

export function PlaceholderPage({ iaCode, title, phaseHint }: Props) {
  return (
    <Card>
      <Space orientation="vertical" size="small" className="w-full">
        <Space>
          <Tag>{iaCode}</Tag>
          <Title level={3} className="!m-0">
            {title}
          </Title>
        </Space>
        <Paragraph type="secondary">{phaseHint}</Paragraph>
      </Space>
    </Card>
  );
}
