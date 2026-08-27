import type { GlobalToken, ThemeConfig } from "antd";

export type AuthPromptMode = "login" | "sign-up";

type AuthPromptOuterToken = Pick<GlobalToken, "colorPrimary">;

export function createAuthPromptTheme(
  mode: AuthPromptMode,
  token: AuthPromptOuterToken,
): ThemeConfig {
  return {
    components: {
      Input: {
        activeBorderColor:
          mode === "login"
            ? "var(--app-color-auth-prompt-login-focus-border)"
            : token.colorPrimary,
        activeShadow:
          mode === "login"
            ? "var(--app-shadow-auth-prompt-login-focus)"
            : "var(--app-shadow-auth-prompt-focus)",
      },
      Select: {
        activeBorderColor: token.colorPrimary,
        activeOutlineColor: "var(--app-color-auth-prompt-focus-outline)",
      },
    },
  };
}
