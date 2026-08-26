import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const COMPONENT_PATHS = [
  "src/components/library/LibraryFeedbackWaitingPanel.tsx",
  "src/components/library/LibraryItemRow.tsx",
  "src/components/library/LibraryKpiStrip.tsx",
  "src/components/library/LibraryReviewCandidateCard.tsx",
  "src/components/library/LibraryReviewQuestionNumber.tsx",
];
const TYPOGRAPHY_RECIPE_PATH =
  "src/components/library/LibraryTypography.module.css";
const ITEM_ROW_RECIPE_PATH = "src/components/library/LibraryItemRow.module.css";
const TYPOGRAPHY_CONSUMERS = [
  {
    path: "src/components/library/LibraryFeedbackWaitingPanel.tsx",
    recipe: "metadata",
    expectedUses: 1,
  },
  {
    path: "src/components/library/LibraryReviewCandidateCard.tsx",
    recipe: "metadata",
    expectedUses: 4,
  },
  {
    path: "src/components/library/LibraryKpiStrip.tsx",
    recipe: "kpiValue",
    expectedUses: 3,
  },
];

describe("library visual style ownership", () => {
  it("keeps the targeted library components free of arbitrary visual utilities", async () => {
    const sources = await Promise.all(
      COMPONENT_PATHS.map(async (path) => ({
        path,
        content: await readFile(path, "utf8"),
      })),
    );
    const result = scanUiContract(sources);

    expect(
      result.violations.filter(
        (violation) => violation.ruleId === "tailwind.arbitrary-visual",
      ),
    ).toEqual([]);
  });

  it("derives library metadata and KPI typography from L2 font-size tokens", async () => {
    const css = await readFile(TYPOGRAPHY_RECIPE_PATH, "utf8").catch(() => "");

    expect(css).toMatch(
      /\.metadata\s*\{[\s\S]*?font-size:\s*var\(--app-font-size-body\)\s*!important;[\s\S]*?line-height:\s*calc\(var\(--app-font-size-body\)\s*\*\s*11\s*\/\s*7\)\s*!important;/u,
    );
    expect(css).toMatch(
      /\.kpiValue\s*\{[\s\S]*?font-size:\s*calc\(var\(--app-font-size-heading\)\s*\*\s*3\s*\/\s*4\)\s*!important;/u,
    );
    expect(css).not.toMatch(/(?:14|22|24)px/u);
  });

  it("connects every library typography consumer to the shared CSS module recipe", async () => {
    for (const { path, recipe, expectedUses } of TYPOGRAPHY_CONSUMERS) {
      const source = await readFile(path, "utf8");

      expect(source).toContain(
        'import typographyStyles from "./LibraryTypography.module.css";',
      );
      expect(
        source.match(new RegExp(`typographyStyles\\.${recipe}`, "gu")),
      ).toHaveLength(expectedUses);
    }
  });

  it("keeps the row border in its local CSS owner and on the L2 secondary-border token", async () => {
    const [component, css] = await Promise.all([
      readFile("src/components/library/LibraryItemRow.tsx", "utf8"),
      readFile(ITEM_ROW_RECIPE_PATH, "utf8").catch(() => ""),
    ]);

    expect(component).toContain(
      'import styles from "./LibraryItemRow.module.css";',
    );
    expect(component).toContain("styles.row");
    expect(component).not.toContain("<Divider");
    expect(component).not.toContain("border-transparent");
    expect(component).not.toContain("ConfigProvider");
    expect(component).not.toContain("theme.useToken");
    expect(component).not.toContain("colorSplit:");
    expect(component).not.toContain(
      "border-[var(--ant-color-border-secondary)]",
    );
    expect(css).toMatch(
      /\.row\s*\{\s*border-bottom:\s*1px solid var\(--app-color-border-secondary\);\s*\}/u,
    );
  });
});
