import { readFileSync } from "node:fs";
import path from "node:path";

import postcss from "postcss";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

const tokenizedRadiusRules = [
  ".landing-layout-service__frame",
  ".landing-layout-testimonials article",
  ".landing-layout-stat",
  ".landing-layout-feature",
  ".writing-material-card__cell",
  ".writing-guide-accordion.ant-collapse > .ant-collapse-item",
  ".writing-guide-accordion.ant-collapse > .ant-collapse-item:first-child, .writing-guide-accordion.ant-collapse > .ant-collapse-item:last-child, .writing-guide-accordion.ant-collapse > .ant-collapse-item",
] as const;
const tokenizedRadiusRuleSet = new Set<string>(tokenizedRadiusRules);
const writingPillRadiusRules = [
  ".writing-exam-header__back",
  ".writing-exam-header__timer",
  ".writing-material-value-list__bullet",
  ".writing-inline-blank__index",
  ".writing-guide-list > li::before, .writing-guide-list--examples > li::before",
] as const;
const writingPillRadiusRuleSet = new Set<string>(writingPillRadiusRules);
const problemTypeTabsCss = readFileSync(
  path.join(
    process.cwd(),
    "src",
    "components",
    "practice",
    "ProblemTypeTabs.module.css",
  ),
  "utf8",
);

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/gu, " ").trim();
}

describe("global CSS radius token contract", () => {
  test("maps default six-pixel UI radii to the shared app radius token", () => {
    const root = postcss.parse(globalCss, { from: "src/styles/global.css" });
    const actual = new Map<string, string[]>();

    root.walkRules((rule) => {
      const selector = normalizeSelector(rule.selector);
      if (!tokenizedRadiusRuleSet.has(selector)) return;

      const values = actual.get(selector) ?? [];
      rule.walkDecls("border-radius", (declaration) => {
        values.push(declaration.value);
      });
      actual.set(selector, values);
    });

    expect(Object.fromEntries(actual)).toEqual(
      Object.fromEntries(
        tokenizedRadiusRules.map((selector) => [
          selector,
          ["var(--app-radius)"],
        ]),
      ),
    );
  });

  test("preserves asymmetric radii that define composite shapes", () => {
    const asymmetricRadii = ["14px 14px 6px 6px", "6px 6px 2px 2px"];

    for (const value of asymmetricRadii) {
      expect(globalCss).toContain(`border-radius: ${value};`);
    }
  });

  test("keeps the problem type lock badge on the shared pill radius", () => {
    expect(globalCss).not.toContain(".problem-type-tabs__badge");
    expect(problemTypeTabsCss).toContain(
      "border-radius: var(--app-radius-pill);",
    );
    expect(problemTypeTabsCss).not.toContain("border-radius: 999px;");
  });

  test("maps circular writing controls and bullets to the shared pill radius", () => {
    const root = postcss.parse(globalCss, { from: "src/styles/global.css" });
    const actual = new Map<string, string[]>();

    root.walkRules((rule) => {
      const selector = normalizeSelector(rule.selector);
      if (!writingPillRadiusRuleSet.has(selector)) return;

      const values = actual.get(selector) ?? [];
      rule.walkDecls("border-radius", (declaration) => {
        values.push(declaration.value);
      });
      actual.set(selector, values);
    });

    expect(Object.fromEntries(actual)).toEqual(
      Object.fromEntries(
        writingPillRadiusRules.map((selector) => [
          selector,
          ["var(--app-radius-pill)"],
        ]),
      ),
    );
  });
});
