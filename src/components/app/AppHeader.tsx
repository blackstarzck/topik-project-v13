"use client";

import { Button, Layout, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { Menu as MenuIcon } from "lucide-react";

const { Header } = Layout;
const { Title, Text } = Typography;

type Props = {
  email?: string | null;
  /** 모바일에서만 햄버거 토글을 보여 준다(area 1 제약: 모바일은 햄버거로 전환). */
  showMenuToggle?: boolean;
  onMenuToggle?: () => void;
};

export function AppHeader({ email, showMenuToggle, onMenuToggle }: Props) {
  const t = useTranslations("app");
  return (
    <Header
      style={{
        background: "var(--app-color-bg-container)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid var(--app-color-border)",
      }}
    >
      <Space size={12} align="center">
        {showMenuToggle ? (
          <Button
            type="text"
            aria-label={t("openMenu")}
            onClick={onMenuToggle}
            icon={<MenuIcon aria-hidden size={20} />}
          />
        ) : null}
        <Title level={4} style={{ margin: 0 }}>
          {t("brand")}
        </Title>
      </Space>
      <Space>
        {email ? <Text type="secondary">{email}</Text> : null}
      </Space>
    </Header>
  );
}
