import { readFileSync } from "node:fs";
import { join } from "node:path";

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const stylesheet = postcss.parse(globalCss, { from: "src/styles/global.css" });
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
    const line = rule.source?.start?.line ?? 0;
    if (
      line >= 381 &&
      line <= 959 &&
      rule.selectors.some((candidate) => normalize(candidate) === selector)
    ) {
      matches.push(rule);
    }
  });
  return matches;
}

function declarationValues(selector: string, property: string) {
  const declarations: Declaration[] = [];
  rulesFor(selector).forEach((rule) =>
    rule.walkDecls(property, (declaration) => declarations.push(declaration)),
  );
  return declarations.map((declaration) => declaration.value);
}

function declarationValue(selector: string, property: string) {
  const values = declarationValues(selector, property);
  expect(values, `${selector} { ${property} }`).toHaveLength(1);
  return values[0];
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
    `${SURFACE} .ant-input-affix-wrapper`,
    "background",
    "var(--app-color-bg-container)",
  ],
  [`${SURFACE} .ant-input:focus`, "border-color", "var(--app-color-primary)"],
  [SELECT, "background", "var(--app-color-bg-container)"],
  [SELECTOR, "background", "var(--app-color-bg-container)"],
  [`${PANEL} .signup-social-button.ant-btn`, "color", "var(--app-color-text)"],
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
  [`${PRIMARY}:disabled`, "border-color", "rgba(0, 0, 0, 0.15)"],
  [`${PRIMARY}:disabled`, "background", "rgba(0, 0, 0, 0.04)"],
  [`${PRIMARY}:disabled`, "color", "rgba(0, 0, 0, 0.45)"],
  [`${LOGIN} .ant-input:focus`, "border-color", "#aab5ff"],
  [
    `${LOGIN} .ant-input:focus`,
    "box-shadow",
    "0 0 0 2px rgba(82, 102, 255, 0.1)",
  ],
  [`${SURFACE} .ant-input-affix-wrapper`, "border-radius", "8px"],
  [SELECT, "border-radius", "8px"],
  [SELECTOR, "border-radius", "8px"],
  [PRIMARY, "border-radius", "8px"],
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

describe("AuthPromptExperience visual tokens", () => {
  it("maps or removes each of the 24 audited auth prompt colors", () => {
    expect(tokenizedDeclarations).toHaveLength(16);
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

  it("preserves disabled, login focus, radius, hero, character, and outer colors", () => {
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
