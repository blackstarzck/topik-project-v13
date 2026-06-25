import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const css = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

function cssRule(selector: string) {
  const escaped = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
}

function fontSize(selector: string) {
  return cssRule(selector).match(/font-size:\s*([^;]+);/)?.[1] ?? "";
}

describe("ProblemTable styles", () => {
  test("keeps problem, difficulty, estimated time, and previous score cells at 16px", () => {
    for (const selector of [
      ".problem-table__type-index--number",
      ".problem-table__title",
      ".problem-table__value",
    ]) {
      expect(fontSize(selector)).toBe("16px");
    }
  });

  test("scopes the analysis tooltip surface strongly enough to override AntD defaults", () => {
    const surfaceRule = cssRule(
      ".problem-table__analysis-tooltip.problem-table__analysis-tooltip .problem-table__analysis-tooltip-body",
    );
    const arrowRule = cssRule(
      ".problem-table__analysis-tooltip.problem-table__analysis-tooltip .problem-table__analysis-tooltip-arrow::before",
    );

    expect(surfaceRule).toContain(
      "background: var(--app-color-bg-container);",
    );
    expect(surfaceRule).toContain("box-shadow:");
    expect(surfaceRule).toContain("var(--app-shadow-elevated)");
    expect(surfaceRule).toContain(
      "0 12px 30px rgba(24, 24, 27, 0.18)",
    );
    expect(surfaceRule).toContain("color: var(--app-color-text);");
    expect(surfaceRule).toContain("font-size: 14px;");
    expect(arrowRule).toContain("background: var(--app-color-bg-container);");
  });
});
