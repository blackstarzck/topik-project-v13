import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { allowedAppBridgeVars, getResolvedBridgeVars } from "../../src/theme";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { phase5dAlternateTheme } from "../e2e/fixtures/phase5d-alternate-theme";

const productionRoles = {
  "--app-color-auth-prompt-canvas": "#ffffff",
  "--app-background-auth-prompt-hero":
    "radial-gradient(circle at 48% 55%, rgba(255, 255, 255, 0.08), transparent 36%), radial-gradient(circle at 28% 78%, rgba(255, 255, 255, 0.05), transparent 30%), linear-gradient(145deg, #202020 0%, #191919 62%, #242424 100%)",
} as const;

const alternateRolesByAppearance = {
  light: {
    "--app-color-auth-prompt-canvas": "#d7f8ff",
    "--app-background-auth-prompt-hero":
      "linear-gradient(135deg, #3b1c73 0%, #0e5b69 100%)",
  },
  dark: {
    "--app-color-auth-prompt-canvas": "#160d2b",
    "--app-background-auth-prompt-hero":
      "linear-gradient(135deg, #120823 0%, #00473d 100%)",
  },
} as const;

describe("auth prompt background theme contract", () => {
  test("registers and documents the two live prompt surface roles", () => {
    const design = readFileSync(resolve(process.cwd(), "DESIGN.md"), "utf8");

    for (const role of Object.keys(productionRoles)) {
      expect(allowedAppBridgeVars).toContain(role);
      expect(design).toContain(`\`${role}\``);
    }
    expect(awesomicThemeTokens.authPrompt.canvas).toBe(
      productionRoles["--app-color-auth-prompt-canvas"],
    );
    expect(awesomicThemeTokens.authPrompt.heroBackground).toBe(
      productionRoles["--app-background-auth-prompt-hero"],
    );
  });

  test("preserves both production appearances for Default and Awesomic", () => {
    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject(
          productionRoles,
        );
      }
    }
  });

  test("provides distinct alternate roles by appearance without leaking them into production", () => {
    for (const appearance of ["light", "dark"] as const) {
      expect(
        phase5dAlternateTheme.appBridgeVarsByAppearance[appearance],
      ).toMatchObject(alternateRolesByAppearance[appearance]);
    }

    const alternateValues = Object.values(alternateRolesByAppearance).flatMap(
      Object.values,
    );
    expect(new Set(alternateValues)).toHaveLength(alternateValues.length);
    expect(alternateValues).not.toContain(
      productionRoles["--app-color-auth-prompt-canvas"],
    );
    expect(alternateValues).not.toContain(
      productionRoles["--app-background-auth-prompt-hero"],
    );

    const sourceDirectory = resolve(process.cwd(), "src");
    const leakedValues = readdirSync(sourceDirectory, {
      encoding: "utf8",
      recursive: true,
    })
      .filter((relativePath) =>
        [".css", ".ts", ".tsx"].includes(extname(relativePath)),
      )
      .flatMap((relativePath) => {
        const source = readFileSync(
          resolve(sourceDirectory, relativePath),
          "utf8",
        );
        return alternateValues
          .filter((value) => source.includes(value))
          .map((value) => ({ relativePath, value }));
      });

    expect(leakedValues).toEqual([]);
  });
});
