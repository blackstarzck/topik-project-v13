import { readFileSync } from "node:fs";
import path from "node:path";

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const stylesheet = postcss.parse(globalCss, {
  from: "src/styles/global.css",
});

const appCardBodySelectors = [
  ".app-card.app-surface > .ant-card-body",
  ".app-card.app-surface > .ant-card-body:first-child",
  ".app-card.app-surface > .ant-card-body:last-child",
] as const;
const notificationBodySelectors = [
  ".notification-settings-card.app-card.app-surface > .ant-card-body",
  ".notification-settings-card.app-card.app-surface > .ant-card-body:first-child",
  ".notification-settings-card.app-card.app-surface > .ant-card-body:last-child",
] as const;

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/gu, " ").trim();
}

function exactSelectorGroup(selectors: readonly string[]) {
  const expected = selectors.map(normalizeSelector).sort();
  const matches: Rule[] = [];

  stylesheet.walkRules((rule) => {
    const actual = rule.selectors.map(normalizeSelector).sort();
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      matches.push(rule);
    }
  });

  expect(matches, selectors.join(", ")).toHaveLength(1);
  return matches[0];
}

function exactRule(selector: string) {
  return exactSelectorGroup([selector]);
}

function declarationValues(rule: Rule, property: string) {
  return rule.nodes
    .filter(
      (node): node is Declaration =>
        node.type === "decl" && node.prop === property,
    )
    .map((declaration) => declaration.value);
}

function declarationValuesForSelector(selector: string, property: string) {
  const values: string[] = [];
  stylesheet.walkRules((rule) => {
    if (
      !rule.selectors.some(
        (candidate) => normalizeSelector(candidate) === selector,
      )
    ) {
      return;
    }
    values.push(...declarationValues(rule, property));
  });
  return values;
}

describe("shared card and account visual ownership", () => {
  test("uses the zero-radius token and removes redundant AppCard corners", () => {
    expect(
      declarationValues(exactRule(".app-card-compact"), "border-radius"),
    ).toEqual(["var(--app-radius-none)"]);

    const bodyRule = exactSelectorGroup(appCardBodySelectors);
    expect(declarationValues(bodyRule, "border-radius")).toEqual([
      "var(--app-radius-none)",
    ]);
    for (const property of [
      "border-start-start-radius",
      "border-start-end-radius",
      "border-end-start-radius",
      "border-end-end-radius",
    ]) {
      expect(declarationValues(bodyRule, property), property).toEqual([]);
    }
  });

  test("keeps notification cards flat without a duplicate body radius", () => {
    expect(
      declarationValues(
        exactRule(".notification-settings-card.app-card.app-surface"),
        "border-radius",
      ),
    ).toEqual(["var(--app-radius-none)"]);

    const bodyRule = exactSelectorGroup(notificationBodySelectors);
    expect(declarationValues(bodyRule, "padding")).toEqual(["0"]);
    expect(declarationValues(bodyRule, "border-radius")).toEqual([]);
  });

  test("uses the shared secondary border bridge for consent and account rows", () => {
    expect(
      declarationValues(
        exactRule(".auth-consent-document-card.app-card.app-surface"),
        "border",
      ),
    ).toEqual(["1px solid var(--app-color-border-secondary)"]);
    expect(
      declarationValuesForSelector(".account-status-row", "border-bottom"),
    ).toEqual(["1px solid var(--app-color-border-secondary)"]);
  });
});
