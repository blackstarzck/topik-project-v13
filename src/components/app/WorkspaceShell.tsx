"use client";

import { Button, Grid, Layout, Space, Typography } from "antd";
import { Menu as MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { AppDrawer } from "@/components/shared/AppDrawer";
import type { AppRole } from "@/lib/auth/roles";
import { SidebarNav } from "./SidebarNav";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Props = {
  role: AppRole;
  email?: string | null;
  planLabel?: string | null;
  children: ReactNode;
};

export function WorkspaceShell({ role, email, planLabel, children }: Props) {
  const t = useTranslations("app");
  const screens = useBreakpoint();
  const isMobile = screens.md === false;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showDrawer = isMobile && drawerOpen;

  return (
    <Layout className="app-workspace-layout">
      <Sider
        className="app-workspace-sider"
        breakpoint="md"
        collapsedWidth={0}
        width={240}
        trigger={null}
      >
        <SidebarNav role={role} planLabel={planLabel} />
      </Sider>
      <Layout className="app-workspace-main">
        {isMobile ? (
          <Header className="app-workspace-mobile-bar">
            <Space size={12} align="center">
              <Button
                type="text"
                aria-label={t("openMenu")}
                onClick={() => setDrawerOpen(true)}
                icon={<MenuIcon aria-hidden size={20} />}
              />
              <Title className="app-workspace-mobile-brand" level={4}>
                {t("brand")}
              </Title>
            </Space>
            <Space>
              {email ? <Text type="secondary">{email}</Text> : null}
            </Space>
          </Header>
        ) : null}
        <Content className="app-workspace-content">{children}</Content>
      </Layout>

      <AppDrawer
        rootClassName="app-workspace-drawer"
        placement="left"
        size={240}
        open={showDrawer}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
        title={t("menu")}
      >
        <SidebarNav
          role={role}
          planLabel={planLabel}
          onNavigate={() => setDrawerOpen(false)}
        />
      </AppDrawer>
    </Layout>
  );
}
