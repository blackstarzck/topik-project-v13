import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const REPORT_COMPONENT_PATHS = [
  "src/components/reports/BlankTraitComparisonPanel.tsx",
  "src/components/reports/ComparisonKpiBlock.tsx",
  "src/components/reports/ComparisonReportView.tsx",
  "src/components/reports/DimensionComparisonCards.tsx",
  "src/components/reports/SubmissionDiffPanel.tsx",
];

describe("report visual ownership", () => {
  it("uses semantic theme consumers instead of arbitrary visual utilities", async () => {
    const sources = await Promise.all(
      REPORT_COMPONENT_PATHS.map(async (path) => ({
        path,
        content: await readFile(path, "utf8"),
      })),
    );
    const arbitraryVisuals = scanUiContract(sources).violations.filter(
      (violation) => violation.ruleId === "tailwind.arbitrary-visual",
    );

    expect(arbitraryVisuals).toEqual([]);
    expect(sources.map(({ content }) => content).join("\n")).not.toContain(
      "var(--ant-",
    );
  });

  it("normalizes report score typography to the nearest existing L2 scale roles", async () => {
    const [reportView, dimensionCards] = await Promise.all([
      readFile("src/components/reports/ComparisonReportView.tsx", "utf8"),
      readFile("src/components/reports/DimensionComparisonCards.tsx", "utf8"),
    ]);

    // The former one-off sizes were 46px and 36px. The approved L2 mappings
    // are heading-lg (40px, -6px) and heading (32px, -4px), respectively.
    expect(reportView).toContain("!text-heading-lg");
    expect(reportView).not.toContain("!text-[46px]");
    expect(dimensionCards).toContain("text-heading font-semibold");
    expect(dimensionCards).not.toContain("text-[36px]");
  });
});
