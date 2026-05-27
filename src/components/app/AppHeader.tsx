"use client";

import { Layout, Space, Typography } from "antd";

const { Header } = Layout;
const { Title, Text } = Typography;

type Props = {
  email?: string | null;
};

export function AppHeader({ email }: Props) {
  return (
    <Header
      style={{
        background: "var(--app-bg, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid var(--app-border, #f0f0f0)",
      }}
    >
      <Title level={4} style={{ margin: 0 }}>
        TALKPIK
      </Title>
      <Space>
        {email ? <Text type="secondary">{email}</Text> : null}
      </Space>
    </Header>
  );
}
