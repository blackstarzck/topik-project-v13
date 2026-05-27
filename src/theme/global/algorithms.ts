"use client";

// antd 6.x 호환성: theme namespace는 module top-level createContext 의존성이 있어
// server component evaluation 시 런타임 에러. "use client" marker로 boundary 형성.
// algorithm 함수 객체는 client(AntdRegistry/ConfigProvider)에서만 실행되므로 OK.

import { theme } from "antd";

import type { ThemeAppearance } from "../types";

export const appearanceAlgorithms = {
  light: theme.defaultAlgorithm,
  dark: theme.darkAlgorithm,
} satisfies Record<
  ThemeAppearance,
  NonNullable<Parameters<typeof theme.getDesignToken>[0]>["algorithm"]
>;
