import { readFileSync } from "node:fs";
import path from "node:path";

import postcss, {
  type AtRule,
  type Declaration,
  type Root,
  type Rule,
} from "postcss";
import { describe, expect, test } from "vitest";

import { allowedAppBridgeVars, getResolvedBridgeVars } from "../../src/theme";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { phase5dAlternateTheme } from "../e2e/fixtures/phase5d-alternate-theme";

const overlayRole = "--app-color-analysis-handoff-overlay-surface";
const failureActionRadiusRole = "--app-radius-analysis-failure-action";
const productionOverlay =
  "color-mix(in srgb, var(--app-color-bg-container) 62%, transparent)";
const productionActionRadius = "10px";
const alternateByAppearance = {
  light: {
    [overlayRole]: "rgba(239, 66, 189, 0.27)",
    [failureActionRadiusRole]: "18.5px",
  },
  dark: {
    [overlayRole]: "rgba(85, 230, 193, 0.29)",
    [failureActionRadiusRole]: "18.5px",
  },
} as const;

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const foundationCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "foundation.css"),
  "utf8",
);
const design = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");
const stylesheet = postcss.parse(globalCss, { from: "src/styles/global.css" });

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/gu, " ").trim();
}

function rootRules(root: Root, selector: string) {
  const matches: Rule[] = [];
  root.walkRules((rule) => {
    if (
      rule.parent?.type === "root" &&
      normalizeSelector(rule.selector) === selector
    ) {
      matches.push(rule);
    }
  });
  return matches;
}

function exactRootRule(root: Root, selector: string) {
  const matches = rootRules(root, selector);
  expect(matches, selector).toHaveLength(1);
  return matches[0];
}

function declarationValues(rule: Rule, property: string) {
  return rule.nodes
    .filter(
      (node): node is Declaration =>
        node.type === "decl" && node.prop === property,
    )
    .map((node) => node.value.replace(/\s+/gu, " ").trim());
}

function rulesInsideMedia(query: string, selector: string) {
  const matches: Rule[] = [];
  stylesheet.walkAtRules("media", (atRule: AtRule) => {
    if (atRule.params.replace(/\s+/gu, " ").trim() !== query) return;
    atRule.walkRules((rule) => {
      if (normalizeSelector(rule.selector) === selector) matches.push(rule);
    });
  });
  return matches;
}

describe("remaining analysis visual consumers", () => {
  test("projects the two plain-CSS roles through every production and alternate appearance", () => {
    expect(allowedAppBridgeVars).toContain(overlayRole);
    expect(allowedAppBridgeVars).toContain(failureActionRadiusRole);
    expect(design).toContain(`\`${overlayRole}\``);
    expect(design).toContain(`\`${failureActionRadiusRole}\``);
    expect(foundationCss).not.toContain(overlayRole);
    expect(foundationCss).not.toContain(failureActionRadiusRole);

    expect(awesomicThemeTokens).toHaveProperty(
      "analysisHandoff.color.overlaySurface",
      productionOverlay,
    );
    expect(awesomicThemeTokens).toHaveProperty(
      "analysisFailure.radius.action",
      10,
    );

    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject({
          [overlayRole]: productionOverlay,
          [failureActionRadiusRole]: productionActionRadius,
        });
      }
    }

    for (const appearance of ["light", "dark"] as const) {
      expect(
        phase5dAlternateTheme.appBridgeVarsByAppearance[appearance],
      ).toMatchObject(alternateByAppearance[appearance]);
      expect(
        phase5dAlternateTheme.appBridgeVarsByAppearance[appearance][
          overlayRole
        ],
      ).not.toBe(productionOverlay);
      expect(
        phase5dAlternateTheme.appBridgeVarsByAppearance[appearance][
          failureActionRadiusRole
        ],
      ).not.toBe(productionActionRadius);
    }
    expect(alternateByAppearance.light[overlayRole]).not.toBe(
      alternateByAppearance.dark[overlayRole],
    );
    expect(phase5dAlternateTheme.appBridgeVars[overlayRole]).toBe(
      alternateByAppearance.light[overlayRole],
    );
  });

  test("removes dead state-card and meta declarations while preserving page overrides", () => {
    const stateCard = exactRootRule(stylesheet, ".analysis-state-card");
    const failedStateCard = exactRootRule(
      stylesheet,
      ".analysis-loading--failed .analysis-state-card",
    );
    const metaRules = rootRules(stylesheet, ".analysis-loading__meta");
    const pageMeta = exactRootRule(
      stylesheet,
      ".analysis-loading--page .analysis-loading__meta",
    );

    expect(declarationValues(stateCard, "box-shadow")).toEqual([]);
    expect(declarationValues(failedStateCard, "box-shadow")).toEqual([]);
    expect(declarationValues(stateCard, "border")).toEqual(["0"]);
    expect(declarationValues(stateCard, "background")).toEqual(["transparent"]);
    expect(declarationValues(failedStateCard, "border")).toEqual(["0"]);
    expect(declarationValues(failedStateCard, "border-radius")).toEqual([
      "var(--app-radius)",
    ]);

    expect(metaRules).toHaveLength(2);
    expect(
      metaRules.flatMap((rule) => declarationValues(rule, "border-radius")),
    ).toEqual([]);
    expect(
      metaRules.flatMap((rule) => declarationValues(rule, "background")),
    ).toEqual([]);
    expect(
      metaRules.flatMap((rule) => declarationValues(rule, "border")),
    ).toEqual(["1px solid var(--app-color-border)"]);
    expect(declarationValues(pageMeta, "border-radius")).toEqual([
      "var(--app-radius-none)",
    ]);
    expect(declarationValues(pageMeta, "border")).toEqual(["0"]);
    expect(declarationValues(pageMeta, "background")).toEqual(["transparent"]);
    expect(
      rulesInsideMedia("(max-width: 560px)", ".analysis-state-card"),
    ).toEqual([]);
  });

  test("uses the two semantic roles at the exact live consumers", () => {
    const overlay = exactRootRule(stylesheet, ".analysis-state-card__overlay");
    const actions = exactRootRule(
      stylesheet,
      ".analysis-loading__actions .ant-btn",
    );

    expect(declarationValues(overlay, "background")).toEqual([
      `var(${overlayRole})`,
    ]);
    expect(declarationValues(actions, "border-radius")).toEqual([
      `var(${failureActionRadiusRole})`,
    ]);
    expect(declarationValues(actions, "min-height")).toEqual(["42px"]);
    expect(declarationValues(actions, "font-weight")).toEqual(["700"]);
  });
});
