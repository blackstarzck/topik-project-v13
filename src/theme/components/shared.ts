import type { ThemeConfig } from "antd";

// Shared component-level theme tokens (theme.components), applied across all
// presets and both appearances. Branch 1 (minimal risk, PLAN §A) keeps all 9
// GLOBAL tokens at Ant Design v6.4.3 defaults; these are component-scoped
// refinements only; see DESIGN.md and 08-theme-architecture.
//
// Flat buttons: Ant Design ships a subtle drop shadow on primary/default/danger
// buttons (primaryShadow/defaultShadow/dangerShadow). For a calm, focused study
// tool (02-global-styles: "calm learning product, not a loud game UI") we remove
// those shadows so CTAs read quiet and flat. Elevation is reserved for genuinely
// floating surfaces (dropdowns, drawers, modals) via boxShadowSecondary.
export const sharedComponentTokens = {
  Button: {
    primaryShadow: "none",
    defaultShadow: "none",
    dangerShadow: "none",
  },
} satisfies ThemeConfig["components"];
