import { describe, expect, it } from "vitest";

import { createAuthPromptTheme } from "../../../src/components/auth/auth-prompt-theme";

const defaultOuterToken = {
  colorPrimary: "#09090b",
} as const;

describe("AuthPromptExperience scoped AntD theme", () => {
  it("owns only sign-up focus paint and leaves button and geometry tokens outside the scope", () => {
    const scoped = createAuthPromptTheme("sign-up", defaultOuterToken);

    expect(scoped.components).toEqual({
      Input: {
        activeBorderColor: "#09090b",
        activeShadow: "var(--app-shadow-auth-prompt-focus)",
      },
      Select: {
        activeBorderColor: "#09090b",
        activeOutlineColor: "var(--app-color-auth-prompt-focus-outline)",
      },
    });
    expect(scoped.components).not.toHaveProperty("Button");
    expect(scoped.components?.Input).not.toHaveProperty("borderRadius");
    expect(scoped.components?.Input).not.toHaveProperty("controlHeight");
    expect(scoped.components?.Select).not.toHaveProperty("borderRadius");
    expect(scoped.components?.Select).not.toHaveProperty("controlHeight");
  });

  it("keeps the login lavender focus role while leaving select focus theme-owned", () => {
    const scoped = createAuthPromptTheme("login", defaultOuterToken);

    expect(scoped.components?.Input).toMatchObject({
      activeBorderColor: "var(--app-color-auth-prompt-login-focus-border)",
      activeShadow: "var(--app-shadow-auth-prompt-login-focus)",
    });
    expect(scoped.components?.Select).toMatchObject({
      activeBorderColor: defaultOuterToken.colorPrimary,
      activeOutlineColor: "var(--app-color-auth-prompt-focus-outline)",
    });
  });

  it("changes sign-up focus paint with an alternate outer theme", () => {
    const alternate = createAuthPromptTheme("sign-up", {
      colorPrimary: "#6f2cff",
    });

    expect(alternate.components?.Input).toEqual({
      activeBorderColor: "#6f2cff",
      activeShadow: "var(--app-shadow-auth-prompt-focus)",
    });
    expect(alternate.components?.Select).toEqual({
      activeBorderColor: "#6f2cff",
      activeOutlineColor: "var(--app-color-auth-prompt-focus-outline)",
    });
    expect(alternate.components).not.toHaveProperty("Button");
  });
});
