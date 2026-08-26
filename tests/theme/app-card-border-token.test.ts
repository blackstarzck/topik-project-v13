import { readFileSync } from "node:fs";
import path from "node:path";

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, test } from "vitest";

import { allowedAppBridgeVars } from "../../src/theme/bridge-contract";
import { getResolvedBridgeVars } from "../../src/theme/tailwind-bridge";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { phase5dAlternateTheme } from "../e2e/fixtures/phase5d-alternate-theme";

const sharedCardOutlineRole = "--app-color-shared-card-subtle-outline";
const productionOutline =
  "color-mix(in srgb, var(--app-color-border) 25%, var(--app-color-bg-layout))";
const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const designContract = readFileSync(
  path.join(process.cwd(), "DESIGN.md"),
  "utf8",
);
const stylesheet = postcss.parse(globalCss, { from: "src/styles/global.css" });

function exactRule(selector: string): Rule {
  const matches: Rule[] = [];
  stylesheet.walkRules((rule) => {
    if (rule.selector.replace(/\s+/gu, " ").trim() === selector) {
      matches.push(rule);
    }
  });
  expect(matches, selector).toHaveLength(1);
  return matches[0];
}

function declarationValues(rule: Rule, property: string) {
  return rule.nodes
    .filter(
      (node): node is Declaration =>
        node.type === "decl" && node.prop === property,
    )
    .map((declaration) => declaration.value.replace(/\s+/gu, " ").trim());
}

describe("workspace AppCard border token", () => {
  test("documents and projects the shared subtle outline through every appearance", () => {
    expect(designContract).toContain(`\`${sharedCardOutlineRole}\``);
    expect(allowedAppBridgeVars).toContain(sharedCardOutlineRole);
    expect(awesomicThemeTokens.sharedCard.color.subtleOutline).toBe(
      productionOutline,
    );

    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject({
          [sharedCardOutlineRole]: productionOutline,
        });
      }
    }

    for (const appearance of ["light", "dark"] as const) {
      const alternate =
        phase5dAlternateTheme.appBridgeVarsByAppearance[appearance][
          sharedCardOutlineRole
        ];
      expect(alternate).toBeTruthy();
      expect(alternate).not.toBe(productionOutline);
    }
  });

  test("bordered workspace cards consume only the shared subtle outline role", () => {
    expect(
      declarationValues(
        exactRule(".app-cards-bordered .app-card.app-surface"),
        "border",
      ),
    ).toEqual([`1px solid var(${sharedCardOutlineRole})`]);

    expect(
      declarationValues(
        exactRule(
          ".app-cards-bordered .selectable-app-card.app-surface.selectable-app-card--selected",
        ),
        "border-color",
      ),
    ).toEqual(["var(--app-color-primary)"]);
  });
});
