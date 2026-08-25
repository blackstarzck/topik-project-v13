import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const COMPONENT_PATH = "src/components/reports/ComparisonTargetDrawer.tsx";
const CSS_MODULE_PATH =
  "src/components/reports/ComparisonTargetDrawer.module.css";
const OWNERSHIP_RULES = new Set([
  "react.static-inline-style",
  "tailwind.arbitrary-visual",
  "visual.raw-color",
]);
const ANTD_INLINE_ROOT_CLASS_SPECIFICITY = 2;

describe("ComparisonTargetDrawer style ownership", () => {
  it("keeps the five targeted visuals out of inline and arbitrary styles", async () => {
    const [component, css] = await Promise.all([
      readFile(COMPONENT_PATH, "utf8"),
      readFile(CSS_MODULE_PATH, "utf8").catch(() => ""),
    ]);
    const result = scanUiContract([
      { path: COMPONENT_PATH, content: component },
      { path: CSS_MODULE_PATH, content: css },
    ]);

    expect(
      result.violations.filter((violation) =>
        OWNERSHIP_RULES.has(violation.ruleId),
      ),
    ).toEqual([]);
  });

  it("connects the fixed root, mask, and candidate rows to the local CSS module", async () => {
    const component = await readFile(COMPONENT_PATH, "utf8");

    expect(component).toContain(
      'import styles from "./ComparisonTargetDrawer.module.css";',
    );
    expect(component).toContain("styles.root");
    expect(component).toContain("mask: styles.mask");
    expect(component).toContain("styles.option");
    expect(component).toContain("<Divider className={styles.divider}");
    expect(component).not.toContain("rootStyle=");
  });

  it("keeps every AntD drawer slot connected to its local owner", async () => {
    const component = await readFile(COMPONENT_PATH, "utf8");

    for (const slot of [
      "body",
      "header",
      "footer",
      "mask",
      "section",
      "wrapper",
    ]) {
      expect(component).toContain(`${slot}: styles.${slot}`);
    }
    expect(component).not.toContain("styles={{");
  });

  it("preserves the root, mask, boundary, hover, and selected paint", async () => {
    const css = await readFile(CSS_MODULE_PATH, "utf8").catch(() => "");
    const fixedRootRule = css.match(
      /^(?<selector>[^{}]+)\{(?<declarations>[^{}]+)\}/u,
    )?.groups;
    const maskRule = css.match(/\.root\.root\s+\.mask\s*\{([^}]*)\}/u)?.[1];

    const rootClassSpecificity = Array.from(
      fixedRootRule?.selector.matchAll(/\.[a-z][a-z0-9_-]*/giu) ?? [],
    ).length;

    expect(rootClassSpecificity).toBeGreaterThan(
      ANTD_INLINE_ROOT_CLASS_SPECIFICITY,
    );
    expect(fixedRootRule?.declarations).toMatch(/position:\s*fixed;/u);
    expect(fixedRootRule?.declarations).toMatch(/inset:\s*0;/u);
    expect(maskRule).toContain("background: var(--app-color-mask-subtle);");
    expect(maskRule).not.toMatch(/(?:opacity|filter|color-mix)\s*:/u);
    expect(css).toMatch(
      /\.option:hover,\s*\.option\[data-selected="true"\]\s*\{\s*background:\s*var\(--app-color-bg-layout\);/u,
    );
    expect(css).toMatch(/\.divider\.divider\s*\{\s*margin:\s*0;/u);
  });

  it("preserves body, header, footer, section, and viewport sizing", async () => {
    const css = await readFile(CSS_MODULE_PATH, "utf8").catch(() => "");

    expect(css).toMatch(
      /\.body\s*\{[\s\S]*?flex:\s*1 1 0%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;[\s\S]*?padding:\s*0;/u,
    );
    expect(css).toMatch(
      /\.header\s*\{[\s\S]*?padding:\s*24px 24px 14px;[\s\S]*?border-bottom:\s*0;/u,
    );
    expect(css).toMatch(
      /\.footer\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*0;[\s\S]*?z-index:\s*1;[\s\S]*?flex-shrink:\s*0;[\s\S]*?border-top:\s*1px solid var\(--app-color-border\);[\s\S]*?background:\s*var\(--app-color-bg-container\);[\s\S]*?padding:\s*18px 24px 20px;/u,
    );
    expect(css).toMatch(
      /\.section\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/u,
    );
    expect(css).toMatch(/\.wrapper\s*\{\s*height:\s*100dvh;/u);
  });
});
