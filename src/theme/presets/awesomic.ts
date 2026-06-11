import type { AppThemePreset } from "../types";
import { awesomicThemeTokens } from "../tokens/awesomic";

const awesomicToken = {
  colorPrimary: awesomicThemeTokens.color.obsidian,
  colorText: awesomicThemeTokens.color.ink,
  colorTextSecondary: awesomicThemeTokens.color.steel,
  colorBorder: awesomicThemeTokens.color.pebble,
  colorBgLayout: awesomicThemeTokens.color.mist,
  colorBgContainer: awesomicThemeTokens.color.snow,
  colorLink: awesomicThemeTokens.color.graphite,
  colorLinkHover: awesomicThemeTokens.color.obsidian,
  colorLinkActive: awesomicThemeTokens.color.obsidian,
  borderRadius: awesomicThemeTokens.radius.base,
  boxShadow: awesomicThemeTokens.shadow.none,
  boxShadowSecondary: awesomicThemeTokens.shadow.elevated,
};

const awesomicComponents = {
  Button: {
    borderRadius: awesomicThemeTokens.radius.buttonPill,
    defaultShadow: awesomicThemeTokens.shadow.none,
    primaryShadow: awesomicThemeTokens.shadow.none,
    dangerShadow: awesomicThemeTokens.shadow.none,
  },
  Card: {
    borderRadiusLG: awesomicThemeTokens.radius.card,
    boxShadow: awesomicThemeTokens.shadow.none,
  },
  Input: {
    borderRadius: awesomicThemeTokens.radius.input,
  },
  Tag: {
    borderRadiusSM: awesomicThemeTokens.radius.badge,
  },
};

export const awesomicThemePreset = {
  name: "awesomic",
  label: "Awesomic",
  description:
    "DESIGN/Awesomic light theme bound through AntD tokens and the Tailwind bridge.",
  appearances: {
    light: {
      token: awesomicToken,
      components: awesomicComponents,
    },
    dark: {
      token: awesomicToken,
      components: awesomicComponents,
    },
  },
} satisfies AppThemePreset<"awesomic">;
