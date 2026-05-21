"use client";

import { Layout } from "antd";
import type { ReactNode } from "react";
import type { AppRole } from "@/lib/auth/roles";
import { AppHeader } from "./AppHeader";
import { SidebarNav } from "./SidebarNav";

const { Sider, Content } = Layout;

type Props = {
  role: AppRole;
  email?: string | null;
  children: ReactNode;
};

export function WorkspaceShell({ role, email, children }: Props) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="md"
        collapsedWidth={0}
        width={240}
        style={{ background: "var(--app-bg, #fff)" }}
      >
        <SidebarNav role={role} />
      </Sider>
      <Layout>
        <AppHeader email={email} />
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
