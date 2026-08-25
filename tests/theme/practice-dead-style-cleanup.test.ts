import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, test } from "vitest";

import { sharedComponentTokens } from "../../src/theme/components/shared";
import { findCssClassFamilySelectors } from "../test-utils/cssClassFamily";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const selectableAppCardPath = path.join(
  process.cwd(),
  "src",
  "components",
  "shared",
  "SelectableAppCard.tsx",
);
const selectableAppCardSource = readFileSync(selectableAppCardPath, "utf8");
const stylesheet = postcss.parse(globalCss, {
  from: "src/styles/global.css",
});

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/gu, " ").trim();
}

function exactRootRule(selector: string) {
  const matches: Rule[] = [];
  stylesheet.walkRules((rule) => {
    if (
      rule.parent?.type === "root" &&
      normalizeSelector(rule.selector) === selector
    ) {
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
    .map((declaration) => declaration.value);
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(entryPath);
    return /\.[jt]sx?$/u.test(entry.name) ? [entryPath] : [];
  });
}

describe("practice dead style cleanup", () => {
  test("lets the shared Button theme own shadows without weakening weak-area states", () => {
    const baseRule = exactRootRule(".weak-area-choice.ant-btn");
    const selectedRule = exactRootRule(".weak-area-choice--selected.ant-btn");

    expect(sharedComponentTokens.Button?.defaultShadow).toBe("none");
    expect(sharedComponentTokens.Button?.primaryShadow).toBe("none");
    expect(declarationValues(baseRule, "box-shadow")).toEqual([]);
    expect(declarationValues(baseRule, "height")).toEqual(["30px"]);
    expect(declarationValues(baseRule, "border-radius")).toEqual([
      "var(--app-radius)",
    ]);
    expect(declarationValues(selectedRule, "box-shadow")).toEqual([]);
    expect(declarationValues(selectedRule, "outline")).toEqual([
      "2px solid var(--app-color-primary)",
    ]);
    expect(declarationValues(selectedRule, "background")).toEqual([
      "var(--app-color-bg-container)",
    ]);
  });

  test("removes the unsupported selected-label API and its cue style family", () => {
    expect(selectableAppCardSource).not.toMatch(/\bselectedLabel\b/u);
    expect(selectableAppCardSource).not.toContain(
      'import { Check } from "@/components/shared/AppIcons";',
    );
    expect(selectableAppCardSource).not.toContain(
      "selectable-app-card__cue",
    );
    expect(
      findCssClassFamilySelectors(globalCss, ["selectable-app-card__cue"]),
    ).toEqual([]);
  });

  test("keeps production callers from depending on the removed selected-label API", () => {
    const callers = productionTypeScriptFiles(
      path.join(process.cwd(), "src"),
    )
      .filter((filePath) => filePath !== selectableAppCardPath)
      .filter((filePath) =>
        /\bselectedLabel\s*=/u.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => path.relative(process.cwd(), filePath));

    expect(callers).toEqual([]);
  });
});
