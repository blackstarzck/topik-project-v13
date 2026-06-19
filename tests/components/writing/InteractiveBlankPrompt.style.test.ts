import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = join(process.cwd(), "src/styles/global.css");

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
});
