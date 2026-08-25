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
  ".problem-table__action-button.ant-btn",
  ".problem-table__bookmark-button.ant-btn, .writing-exam-header__bookmark-button.ant-btn",
  ".writing-material-card__cell",
  ".writing-guide-accordion.ant-collapse > .ant-collapse-item",
  ".writing-guide-accordion.ant-collapse > .ant-collapse-item:first-child, .writing-guide-accordion.ant-collapse > .ant-collapse-item:last-child, .writing-guide-accordion.ant-collapse > .ant-collapse-item",
  ".writing-guide-accordion.ant-collapse > .ant-collapse-item:not(.ant-collapse-item-active) > .ant-collapse-header",
  ".writing-guide-card",
] as const;
const tokenizedRadiusRuleSet = new Set<string>(tokenizedRadiusRules);

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
    const asymmetricRadii = [
      "14px 14px 6px 6px",
      "6px 6px 2px 2px",
      "6px 6px 0 0",
      "0 0 6px 6px",
    ];

    for (const value of asymmetricRadii) {
      expect(globalCss).toContain(`border-radius: ${value};`);
    }
  });
});
