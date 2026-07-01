import { existsSync, readFileSync } from "node:fs";
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

const questionNeonAssets = [
  [51, "neon-yellow.png"],
  [52, "neon-blue.png"],
  [53, "neon-orange.png"],
  [54, "neon-purple.png"],
] as const;

describe("ProblemTable styles", () => {
  test("keeps title, difficulty, estimated time, and previous score cells at 16px", () => {
    for (const selector of [".problem-table__title", ".problem-table__value"]) {
      expect(fontSize(selector)).toBe("16px");
    }

    expect(fontSize(".problem-table__type-index--number")).toBe("36px");
  });

  test("maps writing question numbers to their neon background assets", () => {
    for (const [questionNo, assetName] of questionNeonAssets) {
      expect(
        existsSync(path.join(process.cwd(), "public", "assets", assetName)),
      ).toBe(true);
      expect(cssRule(`.problem-table__type-index--q${questionNo}`)).toContain(
        `background-image: url("/assets/${assetName}");`,
      );
    }
  });

  test("does not keep problem row tooltip override styles", () => {
    expect(
      cssRule(
        ".problem-table__analysis-tooltip.problem-table__analysis-tooltip .problem-table__analysis-tooltip-body",
      ),
    ).toBe("");
    expect(
      cssRule(
        ".problem-table__analysis-tooltip.problem-table__analysis-tooltip .problem-table__analysis-tooltip-arrow::before",
      ),
    ).toBe("");
  });

  test("styles problem metadata tags as description text with icon size inherited", () => {
    const tagRule = cssRule(".problem-table__tag--meta");
    const iconRule = cssRule(".problem-table__tag-icon");

    expect(tagRule).toContain("color: var(--app-color-text-secondary);");
    expect(tagRule).toContain("font-size: 14px;");
    expect(tagRule).toContain("background: none;");
    expect(tagRule).toContain("border: 0;");
    expect(tagRule).toContain("padding: 0;");
    expect(iconRule).toContain("width: 1em;");
    expect(iconRule).toContain("height: 1em;");
    expect(iconRule).toContain("color: inherit;");
  });

  test("limits problem titles to two visual lines", () => {
    const rule = cssRule(".problem-table__title");

    expect(rule).toContain("display: -webkit-box;");
    expect(rule).toContain("-webkit-line-clamp: 2;");
    expect(rule).toContain("line-clamp: 2;");
    expect(rule).toContain("-webkit-box-orient: vertical;");
    expect(rule).toContain("overflow: hidden;");
  });
});
