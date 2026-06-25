import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const css = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
});
