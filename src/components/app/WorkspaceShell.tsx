"use client";

import { Drawer, Grid, Layout } from "antd";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { AppRole } from "@/lib/auth/roles";
import { AppHeader } from "./AppHeader";
import { SidebarNav } from "./SidebarNav";

const { Sider, Content } = Layout;
const { useBreakpoint } = Grid;

type Props = {
  role: AppRole;
  email?: string | null;
  /** profiles.plan_label — 사이드바 플랜 잠금 판정에 전달. */
  planLabel?: string | null;
  children: ReactNode;
};

/**
 * 워크스페이스 셸.
 *
 * area 1 제약 — "모바일은 햄버거로 전환":
 * 데스크톱(≥md)에서는 좌측 Sider 가 항상 보인다. md 미만(모바일/태블릿)에서는
 * Sider 가 폭 0 으로 접히는데, 이전에는 다시 열 수 있는 가시적 토글이 없어서
 * 모바일 사용자가 내비게이션에 접근할 수 없었다. 이제 헤더에 햄버거 버튼을
 * 두고, 누르면 antd Drawer 로 동일한 SidebarNav 를 띄운다(현재 위치 표시 포함).
 */
export function WorkspaceShell({ role, email, planLabel, children }: Props) {
  const t = useTranslations("app");
  const screens = useBreakpoint();
  // antd Grid 의 md(>=768) 가 true 면 데스크톱. SSR 첫 렌더에서는 screens 가 비어
  // 있을 수 있으므로 md 가 명시적으로 false 일 때만 모바일로 본다.
  const isMobile = screens.md === false;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 데스크톱으로 넓어지면 Drawer 는 항상 닫힌 것으로 본다(렌더 중 파생값).
  // 별도 setState 보정 effect 없이, 모바일일 때만 실제 open 을 반영한다.
  const showDrawer = isMobile && drawerOpen;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="md"
        collapsedWidth={0}
        width={240}
        trigger={null}
        style={{ background: "var(--app-bg, #fff)" }}
      >
        <SidebarNav role={role} planLabel={planLabel} />
      </Sider>
      <Layout>
        <AppHeader
          email={email}
          showMenuToggle={isMobile}
          onMenuToggle={() => setDrawerOpen(true)}
        />
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>

      <Drawer
        placement="left"
        width={240}
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
      </Drawer>
    </Layout>
  );
}
