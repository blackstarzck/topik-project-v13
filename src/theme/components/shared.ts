import type { ThemeConfig } from "antd";

import { awesomicPrimaryActionShadow, awesomicRadii } from "../awesomic";

// Shared component-level theme tokens (theme.components), applied across all
// presets and both appearances. Awesomic visual values are bound here when a
// component-family token is safer than page-specific CSS.
//
// Primary buttons get the Awesomic tactile shadow. Default and danger buttons
// stay flat so elevation does not spread to ordinary controls.
export const sharedComponentTokens = {
  Button: {
    borderRadius: awesomicRadii.pill,
    primaryShadow: awesomicPrimaryActionShadow,
    defaultShadow: "none",
    dangerShadow: "none",
  },
  Card: {
    borderRadiusLG: awesomicRadii.card,
  },
  Input: {
    borderRadius: awesomicRadii.input,
  },
  InputNumber: {
    borderRadius: awesomicRadii.input,
  },
  Select: {
    borderRadius: awesomicRadii.input,
  },
  Tag: {
    borderRadiusSM: awesomicRadii.badge,
  },
} satisfies ThemeConfig["components"];
