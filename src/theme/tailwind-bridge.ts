// antd 6.x 호환성 fix (2026-05-27):
//
// antd 6.x의 `theme` namespace(`antd/es/theme/index.js`)는 첫 줄에 `"use client"`
// marker가 있고, 내부적으로 `@ant-design/cssinjs` hooks(useCacheToken, StyleContext)이
// module top-level에서 `React.createContext`를 호출한다. 따라서 server component
// (layout.tsx 등)에서 직접 `theme.getDesignToken / theme.defaultAlgorithm`을 import해
// evaluate하면 `createContext only works in Client Components` 런타임 에러 발생.
//
// 본 모듈은 RootLayout(server component)의 SSR 첫 페인트용 CSS variable을 반환한다.
// antd token 동적 계산은 server에서 불가하므로 Awesomic light-fixed 정적 fallback을
// 사용하고, 동적 brand/token override는 client 측 ConfigProvider/useToken hook에서
// 처리한다(미래 확장 지점).
//
// 값 출처: AWESOMIC-DESIGN.md + src/theme/presets/default.ts.
// antd v7+로 업그레이드 시 또는 server-side token 계산 path가 다시 열릴 때 재검토.

import type { ThemeConfig } from "antd";

import { awesomicBridgeVars } from "./awesomic";
import type { ThemeAppearance } from "./types";

export type ResolvedBridgeVars = Record<string, string>;

const LIGHT_FIXED_BRIDGE_VARS: ResolvedBridgeVars = awesomicBridgeVars;

/**
 * SSR-safe CSS variable fallback.
 * Server component(RootLayout)에서 호출 가능. antd module 평가 없이 정적 값 반환.
 * 현재 Awesomic은 light-only이므로 appearance 인자는 dark infra 보존용으로만 남긴다.
 */
export function getResolvedBridgeVarsByAppearance(
  _appearance: ThemeAppearance,
): ResolvedBridgeVars {
  void _appearance;
  return LIGHT_FIXED_BRIDGE_VARS;
}

/**
 * @deprecated antd v6.x 호환성 이슈로 server에서 themeConfig.algorithm을 unwrap할 수
 * 없어 동적 token 계산 제거. Awesomic light-fixed fallback만 반환한다.
 * 동적 override가 필요하면 client component에서 `theme.useToken()` hook 사용.
 * 호출자는 가능하면 `getResolvedBridgeVarsByAppearance(appearance)` 직접 사용.
 */
export function getResolvedBridgeVars(
  _themeConfig: ThemeConfig,
): ResolvedBridgeVars {
  void _themeConfig;
  return LIGHT_FIXED_BRIDGE_VARS;
}
