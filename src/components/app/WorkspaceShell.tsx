"use client";

import { Button, Grid, Layout, Space, Typography } from "antd";
import { Menu as MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AppDrawer } from "@/components/shared/AppDrawer";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { AppRole } from "@/lib/auth/roles";
import { SidebarNav } from "./SidebarNav";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

type Props = {
  role: AppRole;
  userId: string;
  email?: string | null;
  planLabel?: string | null;
  children: ReactNode;
};

export function WorkspaceShell({
  role,
  userId,
  email,
  planLabel,
  children,
}: Props) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const screens = useBreakpoint();
  const isMobile = screens.md === false;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showDrawer = isMobile && drawerOpen;
  const isWritingExamRoute =
    pathname === "/writing/short-answer-writing-51" ||
    pathname === "/writing/answer-writing-52" ||
    pathname === "/writing/long-form-writing-53" ||
    pathname === "/writing/essay-writing-54";
  const isOnboardingLearningGoalRoute =
    pathname === "/onboarding/learning-goal";
  const hidesWorkspaceChrome =
    isWritingExamRoute || isOnboardingLearningGoalRoute;
  const isShortFeedbackRoute = pathname.startsWith("/writing/feedback/short/");
  const contentClassName = [
    "app-workspace-content",
    isWritingExamRoute ? "app-workspace-content--exam" : null,
    isOnboardingLearningGoalRoute ? "app-workspace-content--onboarding" : null,
    isShortFeedbackRoute ? "app-workspace-content--feedback-flush" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Layout
      className={
        hidesWorkspaceChrome
          ? "app-workspace-layout app-workspace-layout--exam"
          : "app-workspace-layout"
      }
    >
      {hidesWorkspaceChrome ? null : (
        <Sider
          className="app-workspace-sider"
          breakpoint="md"
          collapsedWidth={0}
          width={300}
          trigger={null}
        >
          <SidebarNav role={role} planLabel={planLabel} />
        </Sider>
      )}
      <Layout className="app-workspace-main">
        {hidesWorkspaceChrome ? null : isMobile ? (
          <Header className="app-workspace-mobile-bar">
            <Button
              type="text"
              aria-label={t("openMenu")}
              onClick={() => setDrawerOpen(true)}
              icon={<MenuIcon aria-hidden size={20} />}
            />
            {/* Absolutely centered in the bar so it stays put regardless of the
                menu/bell widths (e.g. an unread badge on the bell). */}
            <span className="app-workspace-mobile-brand" aria-label={t("brand")}>
              <BrandLogo height={48} />
            </span>
            <Space size={8} align="center">
              {email ? <Text type="secondary">{email}</Text> : null}
              <NotificationBell userId={userId} />
            </Space>
          </Header>
        ) : (
          /* No desktop header exists, so the bell floats fixed at the
             top-right corner of the content area on every workspace page. */
          <div className="app-notification-corner">
            <NotificationBell userId={userId} />
          </div>
        )}
        <Content className={contentClassName}>{children}</Content>
      </Layout>

      {hidesWorkspaceChrome ? null : (
        <AppDrawer
          rootClassName="app-workspace-drawer"
          placement="left"
          size={300}
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
      )}
    </Layout>
  );
}
