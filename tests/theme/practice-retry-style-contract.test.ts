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

function exactDeclaration(rule: Rule, property: string) {
  const matches = rule.nodes.filter(
    (node): node is Declaration =>
      node.type === "decl" && node.prop === property,
  );

  expect(matches, `${rule.selector} ${property}`).toHaveLength(1);
  return matches[0];
}

describe("practice retry visual ownership", () => {
  test.each([
    {
      selector: ".retry-modal-summary .ant-descriptions-view",
      token: "var(--app-radius-practice-retry-summary)",
    },
    {
      selector: ".retry-modal-mode-option.ant-radio-wrapper",
      token: "var(--app-radius-practice-retry-mode-option)",
    },
  ])("uses the retry radius token for $selector", ({ selector, token }) => {
    const declaration = exactDeclaration(
      exactRootRule(selector),
      "border-radius",
    );

    expect(declaration.value).toBe(token);
    expect(declaration.important).toBe(true);
  });
});
