import type { AppThemePreset } from "../types";
import { awesomicThemeTokens } from "../tokens/awesomic";

const formControlFontSize = 16;
const formControlHeight = 40;
const formControlHeightLarge = 48;

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
  // Status seed values stay appearance-neutral. AntD's active algorithm owns
  // the resolved light/dark status, fill, and compact-radius aliases.
  colorError: awesomicThemeTokens.status.light.error,
  colorWarning: awesomicThemeTokens.status.light.warning,
  colorSuccess: awesomicThemeTokens.status.light.success,
  borderRadius: awesomicThemeTokens.radius.base,
  borderRadiusSM: awesomicThemeTokens.radius.badge,
  borderRadiusLG: awesomicThemeTokens.radius.base,
  fontSize: formControlFontSize,
  fontSizeLG: formControlFontSize,
  controlHeight: formControlHeight,
  controlHeightLG: formControlHeightLarge,
  boxShadow: awesomicThemeTokens.shadow.none,
  boxShadowSecondary: awesomicThemeTokens.shadow.elevated,
};

const awesomicComponents = {
  Button: {
    borderRadius: awesomicThemeTokens.radius.button,
    defaultShadow: awesomicThemeTokens.shadow.none,
    primaryShadow: awesomicThemeTokens.shadow.none,
    dangerShadow: awesomicThemeTokens.shadow.none,
  },
  Card: {
    borderRadiusLG: awesomicThemeTokens.radius.card,
    boxShadow: awesomicThemeTokens.shadow.none,
  },
  Form: {
    labelFontSize: formControlFontSize,
    itemMarginBottom: 32,
    verticalLabelPadding: "0 0 12px",
  },
  Input: {
    borderRadius: awesomicThemeTokens.radius.input,
    inputFontSize: formControlFontSize,
    inputFontSizeLG: formControlFontSize,
  },
  Select: {
    optionFontSize: formControlFontSize,
    optionHeight: formControlHeight,
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
      token: {
        ...awesomicToken,
        colorBorderSecondary: awesomicThemeTokens.border.secondary.light,
      },
      components: awesomicComponents,
    },
    dark: {
      token: {
        ...awesomicToken,
        colorBorderSecondary: awesomicThemeTokens.border.secondary.dark,
      },
      components: awesomicComponents,
    },
  },
} satisfies AppThemePreset<"awesomic">;
