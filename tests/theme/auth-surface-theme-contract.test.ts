import { readFileSync } from "node:fs";
import path from "node:path";

import postcss, { type Rule } from "postcss";
import { describe, expect, test } from "vitest";

import { allowedAppBridgeVars } from "../../src/theme/bridge-contract";
import { getResolvedBridgeVars } from "../../src/theme/tailwind-bridge";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { phase5dAlternateTheme } from "../e2e/fixtures/phase5d-alternate-theme";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const designContract = readFileSync(
  path.join(process.cwd(), "DESIGN.md"),
  "utf8",
);
const stylesheet = postcss.parse(globalCss, {
  from: "src/styles/global.css",
});

const productionRoles = {
  "--app-color-auth-consent-document-surface":
    "color-mix(in srgb, var(--app-color-bg-container) 94%, var(--app-color-bg-layout))",
  "--app-radius-auth-verify-email-card": "28px",
  "--app-radius-auth-verify-email-card-compact": "12px",
  "--app-shadow-auth-verify-email-card":
    "0 18px 44px color-mix(in srgb, var(--app-color-primary) 10%, transparent), var(--app-shadow-elevated)",
} as const;

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function findRule(
  selector: string,
  mediaQuery?: string,
): Rule | undefined {
  let match: Rule | undefined;

  stylesheet.walkRules((rule) => {
    if (match || normalize(rule.selector) !== selector) return;
    const parent = rule.parent;
    const enclosingMedia =
      parent?.type === "atrule" && parent.name === "media"
        ? normalize(parent.params)
        : null;

    if ((mediaQuery ?? null) === enclosingMedia) match = rule;
  });

  return match;
}

function declaration(rule: Rule | undefined, property: string) {
  let value: string | undefined;
  rule?.walkDecls(property, (item) => {
    value = normalize(item.value);
  });
  return value;
}

describe("auth surface theme contract", () => {
  test("documents the four auth surface roles", () => {
    for (const role of Object.keys(productionRoles)) {
      expect(designContract).toContain(`\`${role}\``);
      expect(allowedAppBridgeVars).toContain(role);
    }
  });

  test("projects the current auth surface recipes through every production appearance", () => {
    expect(awesomicThemeTokens.authConsent.documentSurface).toBe(
      productionRoles["--app-color-auth-consent-document-surface"],
    );
    expect(awesomicThemeTokens.authVerifyEmail).toEqual({
      radius: {
        card: 28,
        compact: 12,
      },
      shadow: {
        card: productionRoles["--app-shadow-auth-verify-email-card"],
      },
    });

    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject(
          productionRoles,
        );
      }
    }
  });

  test("keeps the alternate auth surface roles distinct and isolated from production", () => {
    const alternateRoles = Object.keys(productionRoles).map(
      (role) =>
        phase5dAlternateTheme.appBridgeVars[
          role as keyof typeof phase5dAlternateTheme.appBridgeVars
        ],
    );

    expect(new Set(alternateRoles).size).toBe(alternateRoles.length);
    expect(alternateRoles.every(Boolean)).toBe(true);
    expect(alternateRoles).not.toContain(
      productionRoles["--app-color-auth-consent-document-surface"],
    );
    expect(alternateRoles).not.toContain(
      productionRoles["--app-radius-auth-verify-email-card"],
    );
    expect(alternateRoles).not.toContain(
      productionRoles["--app-radius-auth-verify-email-card-compact"],
    );
    expect(alternateRoles).not.toContain(
      productionRoles["--app-shadow-auth-verify-email-card"],
    );
  });

  test("consumes only semantic roles in the four auth surface declarations", () => {
    const consentRule = findRule(
      ".auth-consent-document-card.app-card.app-surface",
    );
    const verifyRule = findRule(".verify-email-card.app-card.app-surface");
    const compactVerifyRule = findRule(
      ".verify-email-card.app-card.app-surface",
      "(max-width: 479.98px)",
    );

    expect(declaration(consentRule, "border")).toBe(
      "1px solid var(--app-color-border-secondary)",
    );
    expect(declaration(consentRule, "background")).toBe(
      "var(--app-color-auth-consent-document-surface)",
    );
    expect(declaration(verifyRule, "border-radius")).toBe(
      "var(--app-radius-auth-verify-email-card)",
    );
    expect(declaration(verifyRule, "box-shadow")).toBe(
      "var(--app-shadow-auth-verify-email-card)",
    );
    expect(declaration(compactVerifyRule, "border-radius")).toBe(
      "var(--app-radius-auth-verify-email-card-compact)",
    );
  });
});
