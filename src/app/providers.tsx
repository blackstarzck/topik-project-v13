"use client";

import type { CSSProperties, ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";

import {
  defaultAppearance,
  defaultThemeName,
  getAppTheme,
  getTailwindBridgeVars,
} from "@/theme";

const activeTheme = getAppTheme(defaultThemeName, defaultAppearance);

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={activeTheme.antd}>
      <AntdApp>
        <div
          className="app-theme-bridge"
          data-theme={activeTheme.name}
          data-appearance={activeTheme.appearance}
          style={getTailwindBridgeVars() as CSSProperties}
        >
          {children}
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
