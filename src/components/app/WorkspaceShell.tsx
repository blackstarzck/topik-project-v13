"use client";

import { Avatar, Button, Grid, Layout, Space, Typography } from "antd";
import { Menu as MenuIcon } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AppDrawer } from "@/components/shared/AppDrawer";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { avatarPublicUrl } from "@/components/profile/avatar-upload";
import type { AppRole } from "@/lib/auth/roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SidebarNav } from "./SidebarNav";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

type Props = {
  role: AppRole;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  nickname?: string | null;
  avatarPath?: string | null;
  planLabel?: string | null;
  children: ReactNode;
};

export function WorkspaceShell({
  role,
  userId,
  email,
  displayName,
  nickname,
  avatarPath,
  planLabel,
  children,
}: Props) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const router = useRouter();
  const screens = useBreakpoint();

  // 멀티 탭/기기 동기화: 다른 탭·기기에서 로그아웃되거나 회원 탈퇴로 세션이
  // 무효화되면 이 탭도 로그인 화면으로 보낸다. 권위 있는 차단은 서버측
  // (proxy getUser + workspace layout status 게이트)이고, 이 리스너는 이동 없이
  // 열려만 있는 탭을 위한 best-effort 동기화다. INITIAL_SESSION 은 무시한다.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);
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
  const cleanNickname = cleanProfileText(nickname);
  const cleanDisplayName = cleanProfileText(displayName);
  const cleanEmail = cleanProfileText(email);
  const profileName = cleanNickname ?? cleanDisplayName ?? cleanEmail;
  const profileSecondary =
    cleanEmail && cleanEmail !== profileName
      ? cleanEmail
      : cleanDisplayName && cleanDisplayName !== profileName
        ? cleanDisplayName
        : null;
  const avatarUrl = useMemo(() => {
    if (!avatarPath) return null;
    try {
      return avatarPublicUrl(avatarPath);
    } catch {
      return null;
    }
  }, [avatarPath]);
  const avatarInitial = profileName?.charAt(0).toUpperCase() ?? "?";
  const userSummary = profileName ? (
    <div className="app-workspace-user-summary" aria-label={t("userSummary")}>
      <Avatar
        size={32}
        src={avatarUrl ?? undefined}
        alt={profileName}
        className="app-workspace-user-summary__avatar"
      >
        {avatarUrl ? null : avatarInitial}
      </Avatar>
      <span className="app-workspace-user-summary__copy">
        <Text strong ellipsis className="app-workspace-user-summary__name">
          {profileName}
        </Text>
        {profileSecondary ? (
          <Text
            type="secondary"
            ellipsis
            className="app-workspace-user-summary__meta"
          >
            {profileSecondary}
          </Text>
        ) : null}
      </span>
    </div>
  ) : null;

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
            <span
              className="app-workspace-mobile-brand"
              aria-label={t("brand")}
            >
              <BrandLogo height={48} loading="eager" />
            </span>
            <Space
              size={8}
              align="center"
              className="app-workspace-mobile-actions"
            >
              {userSummary}
              <NotificationBell userId={userId} />
            </Space>
          </Header>
        ) : (
          /* No desktop header exists, so the bell floats fixed at the
             top-right corner of the content area on every workspace page. */
          <div className="app-notification-corner">
            {userSummary}
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

function cleanProfileText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
