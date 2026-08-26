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

const promptSurfaceDeclarations = [
  [
    ".signup-prompt-layout",
    "background",
    "var(--app-color-auth-prompt-canvas)",
  ],
  [
    ".signup-prompt-hero",
    "background",
    "var(--app-background-auth-prompt-hero)",
  ],
] as const;

const removedImageOnlyColorDeclarations = [
  [".signup-prompt-hero", "color"],
  [".signup-prompt-hero .signup-brand", "color"],
  [".signup-brand", "color"],
] as const;

const removedImageOnlyColorRules = [
  ".signup-prompt-hero .signup-brand:hover",
  ".signup-prompt-hero .signup-brand strong",
  ".signup-brand strong",
] as const;

const authCharacterTokenizedDeclarations = [
  [
    ".signup-prompt-character-wrap .signup-character",
    "border-bottom-right-radius",
    "var(--app-radius-auth-character-base-edge)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character",
    "border-bottom-left-radius",
    "var(--app-radius-auth-character-base-edge)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--purple",
    "border-top-left-radius",
    "var(--app-radius-auth-character-body-top)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--purple",
    "border-top-right-radius",
    "var(--app-radius-auth-character-body-top)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--purple",
    "background",
    "var(--app-color-auth-character-purple)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--charcoal",
    "border-top-left-radius",
    "var(--app-radius-card)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--charcoal",
    "border-top-right-radius",
    "var(--app-radius-card)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--charcoal",
    "background",
    "var(--app-color-auth-character-charcoal)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--coral",
    "border-top-left-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--coral",
    "border-top-right-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--coral",
    "background",
    "var(--app-color-auth-character-coral)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--yellow",
    "border-top-left-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--yellow",
    "border-top-right-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-prompt-character-wrap .signup-character--yellow",
    "background",
    "var(--app-color-auth-character-yellow)",
  ],
  [
    ".signup-character__eyes--white i",
    "border-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-character__eyes--white i",
    "background",
    "var(--app-color-auth-character-eye)",
  ],
  [
    ".signup-character__eyes--white i::after",
    "border-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-character__eyes--white i::after",
    "background",
    "var(--app-color-auth-character-ink)",
  ],
  [
    ".signup-character__eyes--dots i",
    "border-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-character__eyes--dots i",
    "background",
    "var(--app-color-auth-character-ink)",
  ],
  [
    ".signup-character__mouth",
    "border-radius",
    "var(--app-radius-auth-character-pill)",
  ],
  [
    ".signup-character__mouth",
    "background",
    "var(--app-color-auth-character-ink)",
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
const removedLegacyControlRules = [
  ".signup-form-surface .ant-input",
  ".signup-form-surface .ant-input-affix-wrapper",
  ".signup-social-button.ant-btn",
  ".signup-form-surface .ant-btn-primary",
  ".signup-social-button.ant-btn:not(:disabled):not(.ant-btn-disabled)",
] as const;

describe("AuthPromptExperience visual tokens", () => {
  it("maps the visible auth character paint and geometry to semantic token consumers", () => {
    expect(authCharacterTokenizedDeclarations).toHaveLength(22);

    for (const [
      selector,
      property,
      value,
    ] of authCharacterTokenizedDeclarations) {
      expect(
        normalize(declarationValue(selector, property) ?? ""),
        `${selector} { ${property} }`,
      ).toBe(normalize(value));
    }
  });

  it("clears the exact 16 visible auth character raw color and geometry scanner violations", () => {
    const promptStart = globalCss.indexOf(".signup-prompt-character-wrap {");
    const promptEnd = globalCss.indexOf(
      ".signup-character-stage.is-typing",
      promptStart,
    );
    const faceStart = globalCss.indexOf(
      ".signup-character__eyes--white i {",
      promptEnd,
    );
    const faceEnd = globalCss.indexOf(".signup-form-surface {", faceStart);
    const actionableRules = new Set([
      "visual.raw-color",
      "visual.raw-radius-shadow-font",
    ]);
    const actionableViolations = scanUiContract([
      {
        path: "auth-character.css",
        content: `${globalCss.slice(promptStart, promptEnd)}\n${globalCss.slice(faceStart, faceEnd)}`,
      },
    ]).violations.filter(({ ruleId }: { ruleId: string }) =>
      actionableRules.has(ruleId),
    );

    expect(promptStart).toBeGreaterThanOrEqual(0);
    expect(promptEnd).toBeGreaterThan(promptStart);
    expect(faceStart).toBeGreaterThan(promptEnd);
    expect(faceEnd).toBeGreaterThan(faceStart);
    expect(actionableViolations).toEqual([]);
  });

  it("removes hidden paper and ground rules plus overridden base body paint", () => {
    for (const selector of [
      ".signup-character-stage__ground",
      ".signup-character-stage__paper",
      ".signup-character-stage__paper span",
      ".signup-character-stage__paper span:nth-child(2)",
      ".signup-character-stage__paper span:nth-child(3)",
    ]) {
      expect(rulesFor(selector), selector).toEqual([]);
    }

    for (const selector of [
      ".signup-character--purple",
      ".signup-character--charcoal",
      ".signup-character--coral",
      ".signup-character--yellow",
    ]) {
      expect(declarationValues(selector, "background"), selector).toEqual([]);
      expect(
        declarationValues(selector, "border-top-left-radius"),
        selector,
      ).toEqual([]);
      expect(
        declarationValues(selector, "border-top-right-radius"),
        selector,
      ).toEqual([]);
      expect(declarationValues(selector, "position"), selector).toEqual([]);
      expect(declarationValue(selector, "left"), selector).toBeTruthy();
      expect(declarationValue(selector, "width"), selector).toBeTruthy();
      expect(declarationValue(selector, "height"), selector).toBeTruthy();
    }

    expect(declarationValue(".signup-character", "position")).toBe("absolute");
    expect(declarationValue(".signup-character--purple", "transform")).toBe(
      "skewX(var(--lean))",
    );
    expect(declarationValue(".signup-character--charcoal", "transform")).toBe(
      "skewX(var(--lean))",
    );
  });

  it("maps or removes each of the 24 audited auth prompt colors", () => {
    expect(tokenizedDeclarations).toHaveLength(11);
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
    for (const selector of removedLegacyControlRules) {
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
    expect(
      rulesFor(
        ".signup-social-button.ant-btn:not(:disabled):not(.ant-btn-disabled)",
      ),
    ).toEqual([]);

    const legacyClusterStart = globalCss.indexOf(".signup-form-surface {");
    const legacyClusterEnd = globalCss.indexOf(
      ".landing-public-shell {",
      legacyClusterStart,
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
      {
        path: "src/styles/legacy-auth-controls.css",
        content: globalCss.slice(legacyClusterStart, legacyClusterEnd),
      },
    ]).violations.filter(({ ruleId }: { ruleId: string }) =>
      actionableRules.has(ruleId),
    );

    expect(clusterStart).toBeGreaterThanOrEqual(0);
    expect(clusterEnd).toBeGreaterThan(clusterStart);
    expect(legacyClusterStart).toBeGreaterThanOrEqual(0);
    expect(legacyClusterEnd).toBeGreaterThan(legacyClusterStart);
    expect(actionableViolations).toEqual([]);
  });

  it("maps the two live prompt surfaces and removes six image-only inherited colors", () => {
    for (const [selector, property, value] of promptSurfaceDeclarations) {
      expect(
        declarationValue(selector, property),
        `${selector} { ${property} }`,
      ).toBe(value);
    }

    for (const [selector, property] of removedImageOnlyColorDeclarations) {
      expect(
        declarationValues(selector, property),
        `${selector} { ${property} }`,
      ).toEqual([]);
    }
    for (const selector of removedImageOnlyColorRules) {
      expect(rulesFor(selector), selector).toEqual([]);
    }

    const clusterStart = globalCss.indexOf(".signup-prompt-layout {");
    const clusterEnd = globalCss.indexOf(
      "\n.signup-character-stage {",
      clusterStart,
    );
    const rawColorViolations = scanUiContract([
      {
        path: "src/styles/global.css",
        content: globalCss.slice(clusterStart, clusterEnd),
      },
    ]).violations.filter(
      ({ ruleId }: { ruleId: string }) => ruleId === "visual.raw-color",
    );

    expect(clusterStart).toBeGreaterThanOrEqual(0);
    expect(clusterEnd).toBeGreaterThan(clusterStart);
    expect(rawColorViolations).toEqual([]);
  });
});
