import { readFileSync } from "node:fs";
import { join } from "node:path";

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

// @ts-expect-error The executable UI contract scanner is intentionally plain ESM.
import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const globalCss = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const stylesheet = postcss.parse(globalCss, { from: "src/styles/global.css" });
const moduleCss = readFileSync(
  join(process.cwd(), "src/components/auth/AuthPromptExperience.module.css"),
  "utf8",
);
const loginFormSource = readFileSync(
  join(process.cwd(), "src/components/auth/LoginForm.tsx"),
  "utf8",
);
const moduleStylesheet = postcss.parse(moduleCss, {
  from: "src/components/auth/AuthPromptExperience.module.css",
});
const PANEL = ".signup-prompt-form-panel";
const SURFACE = `${PANEL} .signup-form-surface`;
const PRIMARY = `${SURFACE} .ant-btn-primary`;
const ENABLED_PRIMARY = `${PRIMARY}:not(:disabled):not(.ant-btn-disabled)`;
const SELECT = `${SURFACE} .ant-select-single`;
const SELECTOR = `${SELECT} .ant-select-selector`;
const LOGIN = `.signup-prompt-layout--login ${SURFACE}`;

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function rulesFor(selector: string) {
  const matches: Rule[] = [];
  stylesheet.walkRules((rule) => {
    if (rule.selectors.some((candidate) => normalize(candidate) === selector)) {
      matches.push(rule);
    }
  });
  return matches;
}

function declarationValues(selector: string, property: string) {
  const declarations: Declaration[] = [];
  rulesFor(selector).forEach((rule) => {
    rule.walkDecls(property, (declaration) => {
      declarations.push(declaration);
    });
  });
  return declarations.map((declaration) => declaration.value);
}

function declarationValue(selector: string, property: string) {
  const values = declarationValues(selector, property);
  expect(values, `${selector} { ${property} }`).toHaveLength(1);
  return values[0];
}

function moduleDeclarationValues(selector: string, property: string) {
  const values: string[] = [];
  moduleStylesheet.walkRules((rule) => {
    if (normalize(rule.selector) !== selector) return;
    rule.walkDecls(property, (declaration) => {
      values.push(declaration.value);
    });
  });
  return values;
}

const tokenizedDeclarations = [
  [PANEL, "background", "var(--app-color-bg-container)"],
  [".signup-prompt-mobile-brand", "color", "var(--app-color-text)"],
  [".signup-prompt-mobile-brand strong", "color", "var(--app-color-text)"],
  [
    ".signup-prompt-form-heading .signup-prompt-form-title.ant-typography",
    "color",
    "var(--app-color-text)",
  ],
  [
    ".signup-prompt-form-heading .signup-prompt-form-subtitle.ant-typography",
    "color",
    "var(--app-color-text-secondary)",
  ],
  [`${SURFACE} .ant-form-item-label > label`, "color", "var(--app-color-text)"],
  [
    ".signup-social-button.ant-btn:not(:disabled):not(.ant-btn-disabled)",
    "color",
    "var(--app-color-text)",
  ],
  [`${PANEL} .auth-input-icon`, "color", "var(--app-color-text-secondary)"],
  [
    `${PANEL} .auth-form-remember.ant-checkbox-wrapper`,
    "color",
    "var(--app-color-text-secondary)",
  ],
  [
    `${LOGIN} .ant-form-item-label > label`,
    "color",
    "var(--app-color-text-secondary)",
  ],
  [
    `${PANEL} .auth-form-divider.ant-divider`,
    "color",
    "var(--app-color-text-secondary)",
  ],
  [
    ".signup-prompt-account-link .signup-prompt-account-link__link",
    "color",
    "var(--app-color-text)",
  ],
] as const;

const removedStateDeclarations = [
  [`${SURFACE} .ant-input-affix-wrapper`, "border-color", "#e5e7eb"],
  [SELECT, "border-color", "#e5e7eb"],
  [SELECTOR, "border-color", "#e5e7eb"],
  [ENABLED_PRIMARY, "border-color", "#191919"],
  [ENABLED_PRIMARY, "background", "#191919"],
  [`${SURFACE} .ant-input:hover`, "border-color", "#cfd4dc"],
  [`${ENABLED_PRIMARY}:hover`, "border-color", "#000000"],
  [`${ENABLED_PRIMARY}:hover`, "background", "#000000"],
] as const;

const removedStateSelectors = [
  `${SURFACE} .ant-input:hover`,
  `${SURFACE} .ant-input-affix-wrapper:hover`,
  `${SURFACE} .ant-select:not(.ant-select-disabled):hover`,
  `${SURFACE} .ant-select:not(.ant-select-disabled):hover .ant-select-selector`,
  `${ENABLED_PRIMARY}:hover`,
  `${ENABLED_PRIMARY}:focus-visible`,
  ENABLED_PRIMARY,
] as const;

const preservedDeclarations = [
  [".signup-prompt-layout", "background", "#ffffff"],
  [".signup-prompt-hero", "color", "#ffffff"],
  [
    ".signup-prompt-character-wrap .signup-character--purple",
    "background",
    "#6c3ff5",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--charcoal",
    "background",
    "#2d2d2d",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--coral",
    "background",
    "#ff9b6b",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--yellow",
    "background",
    "#e8d754",
  ],
] as const;

const removedOwnedVisualRules = [
  `${SURFACE} .ant-form-item-control-input-content > .ant-input`,
  `${SURFACE} .ant-input-affix-wrapper`,
  `${SURFACE} .ant-input:focus`,
  `${SURFACE} .ant-input-affix-wrapper-focused`,
  `${SURFACE} .ant-select-focused`,
  `${SURFACE} .ant-select-focused .ant-select-selector`,
  SELECT,
  SELECTOR,
  PRIMARY,
  `${PRIMARY}:disabled`,
  `${PRIMARY}.ant-btn-disabled`,
  `${LOGIN} .ant-input:focus`,
  `${LOGIN} .ant-input-affix-wrapper-focused`,
] as const;

describe("AuthPromptExperience visual tokens", () => {
  it("maps or removes each of the 24 audited auth prompt colors", () => {
    expect(tokenizedDeclarations).toHaveLength(12);
    expect(removedStateDeclarations).toHaveLength(8);
    for (const [selector, property, value] of tokenizedDeclarations) {
      expect(
        declarationValue(selector, property),
        `${selector} { ${property} }`,
      ).toBe(value);
    }
    for (const [selector, property, value] of removedStateDeclarations) {
      expect(
        declarationValues(selector, property),
        `${selector} { ${property}: ${value} }`,
      ).toEqual([]);
    }
    for (const selector of removedStateSelectors) {
      expect(rulesFor(selector), selector).toEqual([]);
    }
  });

  it("moves live control geometry and state paint out of the global stylesheet", () => {
    for (const selector of removedOwnedVisualRules) {
      expect(rulesFor(selector), selector).toEqual([]);
    }

    expect(moduleCss).toContain("var(--app-size-auth-prompt-control)");
    expect(moduleCss).toContain("var(--app-radius-auth-prompt-control)");
    expect(moduleCss).not.toMatch(/(?:#|rgba?\(|hsla?\()/u);
    expect(moduleCss).not.toMatch(/box-shadow\s*:/u);

    const socialSelector = ".formPanel :global(.signup-social-button.ant-btn)";
    expect(moduleDeclarationValues(socialSelector, "height")).toEqual([
      "var(--app-size-auth-prompt-control)",
    ]);
    expect(moduleDeclarationValues(socialSelector, "border-radius")).toEqual([
      "var(--app-radius-auth-prompt-control)",
    ]);
    expect(moduleDeclarationValues(socialSelector, "background")).toEqual([]);
    expect(moduleDeclarationValues(socialSelector, "color")).toEqual([]);
    expect(moduleCss).not.toMatch(/:global\(\.ant-btn\)(?:\s|\{|,)/u);

    const retryStart = loginFormSource.indexOf("if (magicLinkSent)");
    const retryEnd = loginFormSource.indexOf("\n  return (", retryStart + 1);
    const retrySource = loginFormSource.slice(retryStart, retryEnd);
    expect(retrySource).toContain(
      "<Button onClick={() => setMagicLinkSent(null)}>",
    );
    expect(retrySource).not.toContain("signup-social-button");
    expect(retrySource).not.toContain('type="primary"');
    expect(globalCss).toContain(
      ".signup-social-button.ant-btn:not(:disabled):not(.ant-btn-disabled)",
    );

    const clusterStart = globalCss.indexOf(
      ".signup-prompt-form-panel .signup-form-surface .ant-form-item {",
    );
    const clusterEnd = globalCss.indexOf(
      ".signup-prompt-form-panel .auth-form-divider.ant-divider",
      clusterStart,
    );
    const actionableRules = new Set([
      "antd.broad-state-override",
      "visual.raw-color",
      "visual.raw-radius-shadow-font",
    ]);
    const actionableViolations = scanUiContract([
      {
        path: "src/styles/global.css",
        content: globalCss.slice(clusterStart, clusterEnd),
      },
      {
        path: "src/components/auth/AuthPromptExperience.module.css",
        content: moduleCss,
      },
    ]).violations.filter(({ ruleId }: { ruleId: string }) =>
      actionableRules.has(ruleId),
    );

    expect(clusterStart).toBeGreaterThanOrEqual(0);
    expect(clusterEnd).toBeGreaterThan(clusterStart);
    expect(actionableViolations).toEqual([]);
  });

  it("preserves hero, character, and outer colors outside the control cluster", () => {
    for (const [selector, property, value] of preservedDeclarations) {
      expect(
        declarationValue(selector, property),
        `${selector} { ${property} }`,
      ).toBe(value);
    }
    expect(
      normalize(declarationValue(".signup-prompt-hero", "background") ?? ""),
    ).toBe(
      "radial-gradient( circle at 48% 55%, rgba(255, 255, 255, 0.08), transparent 36% ), radial-gradient( circle at 28% 78%, rgba(255, 255, 255, 0.05), transparent 30% ), linear-gradient(145deg, #202020 0%, #191919 62%, #242424 100%)",
    );
  });
});
