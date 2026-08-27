import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const COMPONENT_PATH = "src/components/library/PdfExportModal.tsx";
const CSS_MODULE_PATH = "src/components/library/PdfExportModal.module.css";
const OWNERSHIP_RULES = new Set([
  "react.static-inline-style",
  "tailwind.arbitrary-visual",
]);

describe("PdfExportModal style ownership", () => {
  it("keeps component visuals out of inline styles and arbitrary visual utilities", async () => {
    const content = await readFile(COMPONENT_PATH, "utf8");
    const result = scanUiContract([{ path: COMPONENT_PATH, content }]);

    expect(
      result.violations.filter((violation) =>
        OWNERSHIP_RULES.has(violation.ruleId),
      ),
    ).toEqual([]);
  });

  it("connects each owned visual to the local CSS module", async () => {
    const component = await readFile(COMPONENT_PATH, "utf8");

    expect(component).toContain(
      'import styles from "./PdfExportModal.module.css";',
    );
    expect(component).toContain("styles.optionsLayout");
    expect(component).toContain("styles.layoutChoice");
    expect(component).toContain("styles.manuscriptGrid");
  });

  it("keeps the desktop split at 1024px with a 320px preview column", async () => {
    const css = await readFile(CSS_MODULE_PATH, "utf8");

    expect(css).toMatch(
      /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.optionsLayout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+320px;/u,
    );
  });

  it("keeps selected and unselected layout borders token-owned", async () => {
    const [component, css] = await Promise.all([
      readFile(COMPONENT_PATH, "utf8"),
      readFile(CSS_MODULE_PATH, "utf8"),
    ]);

    expect(component).toContain("aria-checked={selected}");
    expect(css).toMatch(
      /\.layoutChoice\s*\{\s*border:\s*1px solid var\(--app-color-border\);\s*\}/u,
    );
    expect(css).toMatch(
      /\.layoutChoice\[aria-checked="true"\]\s*\{\s*border-color:\s*var\(--app-color-primary\);\s*\}/u,
    );
  });

  it("keeps the manuscript preview as the two-axis 12px repeating grid", async () => {
    const css = await readFile(CSS_MODULE_PATH, "utf8");

    expect(css).toMatch(/\.manuscriptGrid\s*\{\s*background-image:/u);
    expect(css.match(/repeating-linear-gradient\(/gu)).toHaveLength(2);
    expect(css.match(/transparent 11px/gu)).toHaveLength(2);
    expect(css.match(/var\(--app-color-border\) 11px/gu)).toHaveLength(2);
    expect(css.match(/var\(--app-color-border\) 12px/gu)).toHaveLength(2);
  });
});
