"use client";

import { Layout } from "antd";
import type { ReactNode } from "react";

const { Content } = Layout;

type Props = {
  children: ReactNode;
};

export function WorkspaceShell({ children }: Props) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content style={{ padding: 24 }}>{children}</Content>
    </Layout>
  );
}
