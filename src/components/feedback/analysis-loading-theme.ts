import type { GlobalToken, ThemeConfig } from "antd";

export function createAnalysisStepsTheme(
  colorBgContainer: GlobalToken["colorBgContainer"],
): ThemeConfig {
  return {
    components: {
      Steps: {
        colorPrimaryBg: colorBgContainer,
      },
    },
  };
}
