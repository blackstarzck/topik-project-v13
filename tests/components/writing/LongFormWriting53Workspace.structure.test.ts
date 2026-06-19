import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  process.cwd(),
  "src/components/writing/LongFormWriting53Workspace.tsx",
);
const stylesPath = join(process.cwd(), "src/styles/global.css");

describe("LongFormWriting53Workspace structure", () => {
  it("does not render the q53 review-materials button below the composer", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain('data-testid="q53-review-materials"');
    expect(source).not.toContain('tPage("reviewMaterials")');
    expect(source).not.toContain("onReviewMaterials");
  });

  it("renders the support guide body as a flush bullet list", () => {
    const source = readFileSync(sourcePath, "utf8");
    const styles = readFileSync(stylesPath, "utf8");

    expect(source).toContain('className="writing-guide-copy"');
    expect(source).toContain('<ul className="writing-guide-list">');
    expect(styles).toContain(".writing-guide-accordion--support p");
    expect(styles).toContain("text-align: left;");
    expect(styles).toContain("padding-inline-start: 0;");
    expect(styles).toContain(".writing-guide-list > li::before");
  });
});
