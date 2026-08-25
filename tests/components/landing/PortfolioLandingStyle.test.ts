import { readFileSync } from "node:fs";
import { join } from "node:path";

import postcss from "postcss";
import { describe, expect, test } from "vitest";

// @ts-expect-error The executable UI contract scanner is intentionally plain ESM.
import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const globalCss = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const ownerSource = readFileSync(
  join(process.cwd(), "src/components/landing/PortfolioLandingLayout.tsx"),
  "utf8",
);

function declarationValue(selector: string, property: string) {
  const values: string[] = [];

  postcss.parse(globalCss).walkRules((rule) => {
    if (rule.parent?.type !== "root") return;
    if (
      !rule.selector
        .split(",")
        .map((value) => value.trim())
        .includes(selector)
    ) {
      return;
    }

    rule.walkDecls(property, (declaration) => values.push(declaration.value));
  });

  expect(values, `${selector} { ${property} }`).toHaveLength(1);
  return values[0];
}

const auditedDeclarations = [
  [
    ".landing-layout-number",
    "font-family",
    "var(--app-font-landing-portfolio-numeric)",
  ],
  [
    ".landing-layout-eyebrow",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-eyebrow span",
    "background",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-heading h2",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-heading h2",
    "font-family",
    "var(--app-font-landing-portfolio-display)",
  ],
  [
    ".landing-layout-heading h2 span",
    "color",
    "var(--app-color-landing-portfolio-heading-accent)",
  ],
  [
    ".landing-layout-heading p:not(.landing-layout-eyebrow)",
    "color",
    "var(--app-color-landing-portfolio-supporting)",
  ],
  [
    ".landing-layout-work__caption strong",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-work__caption span",
    "color",
    "var(--app-color-landing-portfolio-faint)",
  ],
  [
    ".landing-layout-work__caption p",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-service__frame > span",
    "color",
    "var(--app-color-landing-portfolio-label)",
  ],
  [
    ".landing-layout-service__frame > span",
    "font-family",
    "var(--app-font-landing-portfolio-numeric)",
  ],
  [
    ".landing-layout-service h3",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-service h3",
    "font-family",
    "var(--app-font-landing-portfolio-display)",
  ],
  [
    ".landing-layout-service p",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-icon",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-testimonials p",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-testimonials strong",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-testimonials__who small",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-stat strong",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-stat span",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-post > span",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-step-content > span",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-step-content > span",
    "font-family",
    "var(--app-font-landing-portfolio-numeric)",
  ],
  [
    ".landing-layout-path > span",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-path > strong",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-path li",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-footer__cta:hover",
    "color",
    "var(--app-color-landing-portfolio-footer-hover)",
  ],
  [
    ".landing-layout-footer p",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-footer__bottom span",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
  [
    ".landing-layout-footer__bottom a",
    "color",
    "var(--app-color-landing-portfolio-foreground)",
  ],
  [
    ".landing-layout-footer__bottom a:hover",
    "color",
    "var(--app-color-landing-portfolio-muted)",
  ],
] as const;

describe("portfolio landing text and foreground tokens", () => {
  test("routes the exact audited 27 colors and 5 font declarations through landing portfolio tokens", () => {
    expect(auditedDeclarations).toHaveLength(32);

    for (const [selector, property, value] of auditedDeclarations) {
      expect(declarationValue(selector, property)).toBe(value);
    }
  });

  test("clears the exact audited scanner cluster without pulling in surface geometry", () => {
    const auditedCss = auditedDeclarations.map(
      ([selector, property]) =>
        `${selector} { ${property}: ${declarationValue(selector, property)}; }`,
    );

    const actionableViolations = scanUiContract([
      { path: "portfolio-landing.css", content: auditedCss.join("\n") },
    ]).violations.filter(
      ({ ruleId, lexeme }: { ruleId: string; lexeme?: string }) =>
        ruleId === "visual.raw-color" ||
        (ruleId === "visual.raw-radius-shadow-font" &&
          lexeme === "font-family"),
    );

    expect(
      new Set(auditedDeclarations.map(([selector]) => selector)),
    ).toHaveLength(28);
    expect(auditedCss).toHaveLength(32);
    expect(actionableViolations).toEqual([]);
  });

  test("keeps the tokenized selectors connected to the live portfolio owner", () => {
    for (const className of [
      "landing-layout-number",
      "landing-layout-eyebrow",
      "landing-layout-work__caption",
      "landing-layout-service__frame",
      "landing-layout-icon",
      "landing-layout-testimonials",
      "landing-layout-stat",
      "landing-layout-step-content",
      "landing-layout-path",
      "landing-layout-footer",
    ]) {
      expect(ownerSource, className).toContain(className);
    }
  });
});
