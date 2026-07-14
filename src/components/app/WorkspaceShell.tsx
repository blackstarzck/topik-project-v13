"use client";

import { Avatar, Button, Grid, Layout, Popover, Typography } from "antd";
import { Menu as MenuIcon } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AppDrawer } from "@/components/shared/AppDrawer";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { avatarPublicUrl } from "@/components/profile/avatar-upload";
import type { AppRole } from "@/lib/auth/roles";
import { APP_ROUTES } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PhoneNumberReminderModal } from "./PhoneNumberReminderModal";
import { SidebarNav } from "./SidebarNav";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

type ProfileActionKey = "profile" | "learning-goal" | "logout";

type ProfileAction = {
  key: ProfileActionKey;
  label: string;
};

type Props = {
  role: AppRole;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  nickname?: string | null;
  avatarPath?: string | null;
  planLabel?: string | null;
  affiliationCode?: string | null;
  phoneNumber?: string | null;
  phoneNumberPromptDismissedAt?: string | null;
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
  affiliationCode,
  phoneNumber,
  phoneNumberPromptDismissedAt,
  children,
}: Props) {
  const t = useTranslations("app");
  const navT = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const screens = useBreakpoint();
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

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
    pathname === APP_ROUTES.onboardingLearningGoal;
  const isFeedbackDetailRoute =
    pathname.startsWith("/writing/feedback/short/") ||
    pathname.startsWith("/writing/feedback/long/");
  const isComparisonReportRoute =
    pathname.startsWith("/writing/reports/") && pathname.endsWith("/compare");
  const isNextProblemRoute = pathname === APP_ROUTES.practiceNext;
  const hidesWorkspaceChrome =
    isWritingExamRoute ||
    isOnboardingLearningGoalRoute ||
    isFeedbackDetailRoute ||
    isComparisonReportRoute ||
    isNextProblemRoute;
  const hidesGlobalFloatingActions = hidesWorkspaceChrome;
  const contentClassName = [
    "app-workspace-content",
    isWritingExamRoute ? "app-workspace-content--exam" : null,
    isOnboardingLearningGoalRoute ? "app-workspace-content--onboarding" : null,
    isFeedbackDetailRoute || isComparisonReportRoute
      ? "app-workspace-content--feedback-flush"
      : null,
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
  const profileActions: ProfileAction[] = [
    { key: "profile", label: navT("profile") },
    { key: "learning-goal", label: navT("settingsLearning") },
    { key: "logout", label: navT("logout") },
  ];
  const handleProfileAction = (key: ProfileActionKey) => {
    setProfileOpen(false);
    if (key === "profile") {
      router.push(APP_ROUTES.profile);
      return;
    }
    if (key === "learning-goal") {
      router.push(APP_ROUTES.settingsLearning);
      return;
    }
    if (key === "logout") {
      signOutFormRef.current?.requestSubmit();
    }
  };
  const profilePopoverContent = profileName ? (
    <div className="app-profile-popover-panel">
      <ul
        className="app-profile-popover-list"
        role="menu"
        aria-label={t("userSummary")}
      >
        {profileActions.map((item) => (
          <li key={item.key} className="app-profile-popover-item">
            <button
              type="button"
              role="menuitem"
              className="app-profile-popover-action"
              onClick={() => handleProfileAction(item.key)}
            >
              <span className="app-profile-popover-action__label">
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  const userSummary = profileName ? (
    <Popover
      open={profileOpen}
      onOpenChange={setProfileOpen}
      placement="bottomRight"
      trigger="click"
      content={profilePopoverContent}
      classNames={{ root: "app-notification-popover app-profile-popover" }}
    >
      <button
        type="button"
        className="app-workspace-user-summary"
        aria-label={t("userSummary")}
      >
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
      </button>
    </Popover>
  ) : null;
  const userActions = (
    <>
      {userSummary}
      {userSummary ? (
        <span className="app-workspace-user-summary__divider" aria-hidden />
      ) : null}
      <NotificationBell userId={userId} affiliationCode={affiliationCode} />
    </>
  );

  return (
    <Layout
      className={[
        "app-workspace-layout",
        hidesWorkspaceChrome ? "app-workspace-layout--chrome-hidden" : null,
        isWritingExamRoute || isOnboardingLearningGoalRoute
          ? "app-workspace-layout--exam"
          : null,
      ]
        .filter(Boolean)
        .join(" ")}
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
            {hidesGlobalFloatingActions ? null : (
              <div className="app-workspace-mobile-actions">{userActions}</div>
            )}
          </Header>
        ) : hidesGlobalFloatingActions ? null : (
          /* No desktop header exists, so global user actions float fixed at
             the top-right corner on regular workspace pages. */
          <div className="app-notification-corner">{userActions}</div>
        )}
        <Content className={contentClassName}>{children}</Content>
      </Layout>

      {/* Rendered for every workspace route (including direct-URL landings); the
          modal self-gates on route/phone/dismiss state and shows at most once
          per session. Only mounted once the profile's phone state is actually
          known (the workspace layout always passes it); `undefined` means the
          caller did not provide it, so we do not prompt. */}
      {phoneNumber === undefined ||
      phoneNumberPromptDismissedAt === undefined ? null : (
        <PhoneNumberReminderModal
          key={userId}
          userId={userId}
          phoneNumber={phoneNumber}
          phoneNumberPromptDismissedAt={phoneNumberPromptDismissedAt}
          pathname={pathname}
        />
      )}

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
      <form
        ref={signOutFormRef}
        method="post"
        action={APP_ROUTES.authSignOut}
        className="app-profile-menu-signout"
        hidden
      />
    </Layout>
  );
}

function cleanProfileText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
