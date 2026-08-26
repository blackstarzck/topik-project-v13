import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

describe("WritingGuideAccordion style ownership", () => {
  it("owns active icon motion locally and leaves outer clipping to the item", async () => {
    const [component, globalCss] = await Promise.all([
      readFile("src/components/writing/WritingGuideAccordion.tsx", "utf8"),
      readFile("src/styles/global.css", "utf8"),
    ]);
    const blockStart = globalCss.indexOf(".writing-guide {");
    const blockEnd = globalCss.indexOf(".writing-guide-copy", blockStart);
    const guideBlock = globalCss.slice(blockStart, blockEnd);
    const actionableViolations = scanUiContract([
      { path: "src/styles/global.css", content: guideBlock },
    ]).violations.filter((violation) =>
      ["antd.broad-state-override", "visual.raw-radius-shadow-font"].includes(
        violation.ruleId,
      ),
    );

    expect(blockStart).toBeGreaterThanOrEqual(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(actionableViolations).toEqual([]);
    expect(component).toContain("expandIcon={({ isActive }) =>");
    expect(component).toContain("writing-guide-accordion__expand-icon");
    expect(component).toContain("writing-guide-accordion__expand-icon--active");
    expect(component).not.toContain("ant-collapse-item-active");
    expect(guideBlock).toContain(".writing-guide-accordion__expand-icon {");
    expect(guideBlock).toContain(
      ".writing-guide-accordion__expand-icon--active {",
    );
    expect(guideBlock).not.toContain("ant-collapse-item-active");
    expect(guideBlock).not.toMatch(/\.writing-guide-card\s*\{/u);
    expect(guideBlock).not.toContain(".writing-guide-card p");
    expect(guideBlock).toMatch(
      /\.writing-guide-accordion\.ant-collapse\s*>\s*\.ant-collapse-item\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?border-radius:\s*var\(--app-radius\);/u,
    );
  });
});
