import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import postcss from "postcss";

import { hasExactCssRule } from "./writing-style-contract";

const cssPath = join(process.cwd(), "src/styles/global.css");
const modulePath = join(
  process.cwd(),
  "src/components/writing/InteractiveBlankPrompt.module.css",
);

function declarationNamesForSelector(source: string, selector: string) {
  const normalizedSelector = selector.replace(/\s+/gu, " ").trim();
  const names = new Set<string>();

  postcss.parse(source).walkRules((rule) => {
    const selectors = rule.selector
      .split(",")
      .map((candidate) => candidate.replace(/\s+/gu, " ").trim());
    if (!selectors.includes(normalizedSelector)) return;
    for (const node of rule.nodes ?? []) {
      if (node.type === "decl") names.add(node.prop);
    }
  });

  return names;
}

function classSpecificity(selector: string) {
  return selector.match(/\.[\w-]+/gu)?.length ?? 0;
}

describe("InteractiveBlankPrompt styles", () => {
  it("keeps inline blank controls aligned with sentence text", () => {
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(/\.writing-inline-blank\s*\{([^}]+)\}/);
    const body = match?.[1] ?? "";

    expect(body).toContain("position: relative;");
    expect(body).toContain("top: -2px;");
    expect(body).toContain("vertical-align: middle;");
    expect(body).toContain("line-height: 1;");
  });

  it("assembles each blank corner from one atomic app radius", () => {
    const globalCss = readFileSync(cssPath, "utf8");
    const moduleCss = readFileSync(modulePath, "utf8");

    expect(
      hasExactCssRule(
        moduleCss,
        ".blank",
        "border-start-start-radius: var(--app-radius); border-start-end-radius: var(--app-radius); border-end-end-radius: var(--app-radius-indicator); border-end-start-radius: var(--app-radius-indicator);",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".blank:focus-visible",
        "box-shadow: var(--app-shadow-writing-blank-focus);",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".blank.active",
        "background: var(--app-color-writing-blank-active-surface); box-shadow: var(--app-shadow-writing-blank-active-inset);",
      ),
    ).toBe(true);
    expect(classSpecificity(".blank.active")).toBeGreaterThan(
      classSpecificity(".writing-inline-blank"),
    );
    expect(
      hasExactCssRule(
        moduleCss,
        ".filled:not(.active)",
        "border-color: var(--app-color-writing-blank-filled-border);",
      ),
    ).toBe(true);

    expect(
      declarationNamesForSelector(globalCss, ".writing-inline-blank").has(
        "border-radius",
      ),
    ).toBe(false);
    expect(
      declarationNamesForSelector(
        globalCss,
        ".writing-inline-blank:focus-visible",
      ).has("box-shadow"),
    ).toBe(false);
    const activeGlobalDeclarations = declarationNamesForSelector(
      globalCss,
      ".writing-inline-blank--active",
    );
    expect(activeGlobalDeclarations.has("background")).toBe(false);
    expect(activeGlobalDeclarations.has("box-shadow")).toBe(false);
    expect(
      declarationNamesForSelector(
        globalCss,
        ".writing-inline-blank--filled:not(.writing-inline-blank--active)",
      ).has("border-color"),
    ).toBe(false);
  });
});
