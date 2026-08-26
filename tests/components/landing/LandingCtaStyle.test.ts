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

function declarationsFor(selector: string) {
  let declarations = "";

  postcss.parse(globalCss).walkRules((rule) => {
    if (rule.parent?.type !== "root") return;
    const selectors = rule.selector.split(",").map((value) => value.trim());
    if (!selectors.includes(selector)) return;

    const ruleDeclarations = (rule.nodes ?? [])
      .filter((node) => node.type === "decl")
      .map((node) => `${node.prop}: ${node.value};`)
      .join(" ");
    declarations = `${declarations} ${ruleDeclarations}`.trim();
  });

  return declarations;
}

describe("live landing CTA style contract", () => {
  test("routes the active CTA paint and geometry through semantic app tokens", () => {
    expect(declarationsFor(".landing-header-button.ant-btn")).toContain(
      "border-radius: var(--app-radius-pill);",
    );
    expect(declarationsFor(".landing-hero-button.ant-btn")).toContain(
      "border-radius: var(--app-radius-landing-hero-cta);",
    );

    const primary = declarationsFor(".landing-header-button--primary.ant-btn");
    expect(primary).toContain(
      "border-color: var(--app-color-landing-cta-primary);",
    );
    expect(primary).toContain(
      "background: var(--app-color-landing-cta-primary);",
    );
    expect(primary).toContain(
      "color: var(--app-color-landing-cta-foreground);",
    );

    const primaryHover = declarationsFor(
      ".landing-header .landing-header-button--primary:not(:disabled):hover",
    );
    expect(primaryHover).toContain(
      "border-color: var(--app-color-landing-cta-primary-hover);",
    );
    expect(primaryHover).toContain(
      "background: var(--app-color-landing-cta-primary-hover);",
    );
    expect(primaryHover).toContain(
      "color: var(--app-color-landing-cta-foreground);",
    );

    const ghost = declarationsFor(".landing-header-button--ghost.ant-btn");
    expect(ghost).toContain(
      "border-color: var(--app-color-landing-cta-ghost-border);",
    );
    expect(ghost).toContain(
      "background: var(--app-color-landing-cta-ghost-surface);",
    );
    expect(ghost).toContain("color: var(--app-color-landing-cta-ghost-text);");

    const ghostHover = declarationsFor(
      ".landing-header .landing-header-button--ghost:not(:disabled):hover",
    );
    expect(ghostHover).toContain(
      "border-color: var(--app-color-landing-cta-ghost-text);",
    );
    expect(ghostHover).toContain(
      "background: var(--app-color-landing-cta-ghost-text);",
    );
    expect(ghostHover).toContain(
      "color: var(--app-color-landing-cta-ghost-surface);",
    );

    const layoutPill = declarationsFor(".landing-layout-pill");
    expect(layoutPill).toContain("border-radius: var(--app-radius-pill);");
    expect(layoutPill).toContain(
      "border: 1px solid var(--app-color-landing-cta-ghost-border);",
    );
    expect(layoutPill).toContain(
      "background: var(--app-color-landing-cta-ghost-surface);",
    );
    expect(layoutPill).toContain(
      "color: var(--app-color-landing-cta-ghost-text);",
    );

    const layoutPillHover = declarationsFor(".landing-layout-pill:hover");
    expect(layoutPillHover).toContain(
      "border-color: var(--app-color-landing-cta-ghost-text);",
    );
    expect(layoutPillHover).toContain(
      "background: var(--app-color-landing-cta-ghost-text);",
    );
    expect(layoutPillHover).toContain(
      "color: var(--app-color-landing-cta-ghost-surface);",
    );
    expect(`${layoutPill} ${layoutPillHover}`).not.toMatch(
      /(?:#[\da-f]{3,8}|rgba?\()/iu,
    );
  });

  test("leaves focus and disabled lifecycle to AntD and removes the unused secondary variant", () => {
    const ctaStart = globalCss.indexOf(".landing-header-button.ant-btn,");
    const ctaEnd = globalCss.indexOf(".landing-hero {", ctaStart);
    const ctaBlock = globalCss.slice(ctaStart, ctaEnd);
    const actionableRules = new Set([
      "antd.broad-state-override",
      "visual.raw-color",
      "visual.raw-radius-shadow-font",
    ]);
    const actionableViolations = scanUiContract([
      { path: "src/styles/global.css", content: ctaBlock },
    ]).violations.filter(({ ruleId }: { ruleId: string }) =>
      actionableRules.has(ruleId),
    );

    expect(ctaStart).toBeGreaterThanOrEqual(0);
    expect(ctaEnd).toBeGreaterThan(ctaStart);
    expect(actionableViolations).toEqual([]);
    expect(ctaBlock).not.toContain("landing-hero-button--secondary");
    expect(ctaBlock).not.toMatch(/:(?:focus|focus-visible|active)\b/u);
    expect(ctaBlock.match(/:not\(:disabled\):hover/gu)).toHaveLength(3);
  });
});
