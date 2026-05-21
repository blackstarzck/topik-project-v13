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
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Space>
          <Tag>{iaCode}</Tag>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
        </Space>
        <Paragraph type="secondary">{phaseHint}</Paragraph>
      </Space>
    </Card>
  );
}
