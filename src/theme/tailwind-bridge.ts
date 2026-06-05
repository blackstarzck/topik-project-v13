// antd 6.x 호환성 fix (2026-05-27):
//
// antd 6.x의 `theme` namespace(`antd/es/theme/index.js`)는 첫 줄에 `"use client"`
// marker가 있고, 내부적으로 `@ant-design/cssinjs` hooks(useCacheToken, StyleContext)이
// module top-level에서 `React.createContext`를 호출한다. 따라서 server component
// (layout.tsx 등)에서 직접 `theme.getDesignToken / theme.defaultAlgorithm`을 import해
// evaluate하면 `createContext only works in Client Components` 런타임 에러 발생.
//
// 본 모듈은 RootLayout(server component)의 SSR 첫 페인트용 CSS variable을 반환.
// antd token 동적 계산은 server에서 불가하므로 light/dark 두 종류의 정적 fallback을
// 사용하고, 동적 brand/token override는 client 측 ConfigProvider/useToken hook에서
// 처리(미래 확장 지점).
//
// 값 출처: antd v6.4.3 default seed token + defaultAlgorithm 결과 (light/dark).
// antd v7+로 업그레이드 시 또는 server-side token 계산 path가 다시 열릴 때 재검토.

import type { ThemeConfig } from "antd";

import { appFontFamily } from "./global/shared-seed";
import type { ThemeAppearance } from "./types";

export type ResolvedBridgeVars = Record<string, string>;

// antd `formatToken`(util/alias.js:24-26)은 colorShadow의 alpha를 base로
// 0.08/0.12/0.05 multiplier를 곱해 boxShadowSecondary를 계산한다.
// light: colorShadow=#000 (alpha=1.0) → rgba(0,0,0,0.08/0.12/0.05)
// dark:  colorShadow=rgba(255,255,255,0.2) (alpha=0.2) → rgba(255,255,255,0.016/0.024/0.01)
const LIGHT_SHADOW_ELEVATED =
  "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)";
const DARK_SHADOW_ELEVATED =
  "0 6px 16px 0 rgba(255, 255, 255, 0.016), 0 3px 6px -4px rgba(255, 255, 255, 0.024), 0 9px 28px 8px rgba(255, 255, 255, 0.01)";

const LIGHT_BRIDGE_VARS: ResolvedBridgeVars = {
  "--app-color-primary": "#1677ff",
  "--app-color-bg-layout": "#f5f5f5",
  "--app-color-bg-container": "#ffffff",
  "--app-color-text": "rgba(0, 0, 0, 0.88)",
  "--app-color-text-secondary": "rgba(0, 0, 0, 0.65)",
  "--app-color-border": "#d9d9d9",
  "--app-radius": "6px",
  "--app-font-family": appFontFamily,
  "--app-shadow-elevated": LIGHT_SHADOW_ELEVATED,
};

const DARK_BRIDGE_VARS: ResolvedBridgeVars = {
  "--app-color-primary": "#1668dc",
  "--app-color-bg-layout": "#000000",
  "--app-color-bg-container": "#141414",
  "--app-color-text": "rgba(255, 255, 255, 0.85)",
  "--app-color-text-secondary": "rgba(255, 255, 255, 0.65)",
  "--app-color-border": "#424242",
  "--app-radius": "6px",
  "--app-font-family": appFontFamily,
  "--app-shadow-elevated": DARK_SHADOW_ELEVATED,
};

/**
 * SSR-safe CSS variable fallback by appearance.
 * Server component(RootLayout)에서 호출 가능. antd module 평가 없이 정적 값 반환.
 */
export function getResolvedBridgeVarsByAppearance(
  appearance: ThemeAppearance,
): ResolvedBridgeVars {
  return appearance === "dark" ? DARK_BRIDGE_VARS : LIGHT_BRIDGE_VARS;
}

/**
 * @deprecated antd v6.x 호환성 이슈로 server에서 themeConfig.algorithm을 unwrap할 수
 * 없어 동적 token 계산 제거. appearance 기반으로 light/dark fallback만 반환한다.
 * 동적 override가 필요하면 client component에서 `theme.useToken()` hook 사용.
 * 호출자는 가능하면 `getResolvedBridgeVarsByAppearance(appearance)` 직접 사용.
 */
export function getResolvedBridgeVars(
  _themeConfig: ThemeConfig,
): ResolvedBridgeVars {
  return LIGHT_BRIDGE_VARS;
}
