import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import ts from "typescript";
import { describe, expect, test } from "vitest";

import { scanUiContract } from "../../scripts/lib/ui-contract.mjs";

const componentPath = "src/components/auth/PasswordStrengthMeter.tsx";

function collectSourceStringTokens(content) {
  const sourceFile = ts.createSourceFile(
    componentPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const tokens = [];

  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) {
      tokens.push(...node.text.split(/\s+/u).filter(Boolean));
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return tokens;
}

function isColorTransitionClass(className) {
  const utility = className.split(":").at(-1)?.replace(/^!|!$/gu, "");
  if (
    utility === "transition" ||
    utility === "transition-colors" ||
    utility === "transition-all"
  ) {
    return true;
  }

  const arbitraryProperties = /^transition-\[([^\]]+)\]$/u.exec(utility)?.[1];
  return Boolean(
    arbitraryProperties
      ?.split(",")
      .map((property) => property.replaceAll("_", " ").trim())
      .some(
        (property) => property === "color" || property === "background-color",
      ),
  );
}

describe("password strength theme consumer contract", () => {
  test("does not animate meter segment colors", () => {
    const content = readFileSync(resolve(process.cwd(), componentPath), "utf8");
    const forbiddenTransitionClasses = collectSourceStringTokens(
      content,
    ).filter(isColorTransitionClass);

    expect(forbiddenTransitionClasses).toEqual([]);
  });

  test("has no arbitrary Tailwind visual values or direct AntD variable chains", () => {
    const content = readFileSync(resolve(process.cwd(), componentPath), "utf8");
    const violations = scanUiContract([
      { path: componentPath, content },
    ]).violations.filter(
      (violation) => violation.ruleId === "tailwind.arbitrary-visual",
    );

    expect(violations).toEqual([]);
    expect(content).not.toContain("var(--ant-");
  });
});
