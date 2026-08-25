// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import postcss from "postcss";

import { ManuscriptPreview } from "../../../src/components/writing/ManuscriptPreview";
import manuscriptStyles from "../../../src/components/writing/ManuscriptPreview.module.css";
import {
  IntlAntdWrapper,
  renderWithIntl,
} from "../../test-utils/renderWithIntl";
import {
  findGlobalCssOwners,
  hasStableAndScopedClasses,
  hasExactCssRule,
} from "./writing-style-contract";

afterEach(() => cleanup());

const globalCssPath = join(process.cwd(), "src/styles/global.css");
const modulePath = join(
  process.cwd(),
  "src/components/writing/ManuscriptPreview.module.css",
);

function declarationNamesForSelector(source: string, selector: string) {
  const names = new Set<string>();

  postcss.parse(source).walkRules((rule) => {
    if (!rule.selectors?.includes(selector)) return;
    for (const node of rule.nodes ?? []) {
      if (node.type === "decl") names.add(node.prop);
    }
  });

  return names;
}

describe("ManuscriptPreview", () => {
  it("owns its outer layout and header without a global CSS dependency", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/writing/ManuscriptPreview.tsx"),
      "utf8",
    );
    expect(existsSync(modulePath)).toBe(true);
    if (!existsSync(modulePath)) return;

    const moduleCss = readFileSync(modulePath, "utf8");
    expect(
      hasExactCssRule(
        moduleCss,
        ".preview",
        "display: grid; height: 100%; min-height: 0; grid-template-rows: auto auto minmax(0, 1fr); gap: 8px;",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".grid",
        "font-family: var(--app-font-writing-manuscript-mono);",
      ),
    ).toBe(true);
    const sectionRules = [
      [
        ".cell.intro.highlighted",
        "background: var(--app-color-writing-manuscript-intro-surface); border-color: var(--app-color-writing-manuscript-intro-border); box-shadow: var(--app-shadow-writing-manuscript-intro-inset);",
      ],
      [
        ".cell.body.highlighted",
        "background: var(--app-color-writing-manuscript-body-surface); border-color: var(--app-color-writing-manuscript-body-border); box-shadow: var(--app-shadow-writing-manuscript-body-inset);",
      ],
      [
        ".cell.conclusion.highlighted",
        "background: var(--app-color-writing-manuscript-conclusion-surface); border-color: var(--app-color-writing-manuscript-conclusion-border); box-shadow: var(--app-shadow-writing-manuscript-conclusion-inset);",
      ],
    ] as const;
    expect(
      sectionRules
        .filter(
          ([selector, declarations]) =>
            !hasExactCssRule(moduleCss, selector, declarations),
        )
        .map(([selector]) => selector),
    ).toEqual([]);
    expect(moduleCss).not.toContain("--writing-manuscript-section-");
    expect(moduleCss).not.toContain("color-mix(");
    expect(moduleCss).not.toContain("var(--ant-");
    expect(moduleCss).not.toContain("ui-monospace");
    expect(
      hasExactCssRule(
        moduleCss,
        ".compact",
        "grid-template-rows: minmax(0, 1fr);",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".title:global(.ant-typography)",
        "margin: 0;",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".meta:global(.ant-typography)",
        "display: block;",
      ),
    ).toBe(true);
    expect(source).toContain(
      'import styles from "./ManuscriptPreview.module.css";',
    );
    expect(source).toMatch(/"writing-manuscript-preview",\s*styles\.preview/u);
    expect(source).toContain('!showHeader ? styles.compact : ""');
    expect(source).toMatch(
      /"writing-manuscript-preview__title",\s*styles\.title/u,
    );
    expect(source).toMatch(
      /"writing-manuscript-preview__meta",\s*styles\.meta/u,
    );
    expect(source).toMatch(
      /"writing-manuscript-preview__grid",\s*styles\.grid/u,
    );
    expect(source).toContain("styles.cell");
    expect(source).toContain("styles.highlighted");
    expect(source).toContain("styles.intro");
    expect(source).toContain("styles.body");
    expect(source).toContain("styles.conclusion");

    const globalCss = readFileSync(globalCssPath, "utf8");
    expect(globalCss).not.toContain("--writing-manuscript-section-");
    expect(
      declarationNamesForSelector(
        globalCss,
        ".writing-manuscript-preview__grid",
      ).has("font-family"),
    ).toBe(false);
    for (const selector of [
      ".writing-manuscript-preview__cell--highlighted",
      ".writing-manuscript-preview__cell--body.writing-manuscript-preview__cell--highlighted",
      ".writing-manuscript-preview__cell--conclusion.writing-manuscript-preview__cell--highlighted",
    ]) {
      expect(declarationNamesForSelector(globalCss, selector).size).toBe(0);
    }
    expect(
      findGlobalCssOwners([
        "writing-manuscript-preview",
        "writing-manuscript-preview--compact",
        "writing-manuscript-preview__title",
        "writing-manuscript-preview__meta",
      ]),
    ).toEqual([]);

    renderWithIntl(<ManuscriptPreview text="" showHeader={false} />);
    expect(
      hasStableAndScopedClasses(
        screen.getByTestId("manuscript-preview"),
        "writing-manuscript-preview--compact",
        manuscriptStyles.compact,
      ),
    ).toBe(true);
  });

  it("marks each filled cell with its writing section and highlights the active section", () => {
    const labels = {
      intro: "도입",
      body: "전개",
      conclusion: "마무리",
    } as const;
    const renderPreview = (activeSection: "intro" | "body" | "conclusion") => (
      <ManuscriptPreview
        text="ABC"
        cellSections={["intro", "body", "conclusion"]}
        activeSection={activeSection}
        sectionLabels={labels}
      />
    );
    const { rerender } = render(renderPreview("intro"), {
      wrapper: IntlAntdWrapper,
    });

    const cells = screen.getAllByTestId("manuscript-preview-cell");
    expect(
      hasStableAndScopedClasses(
        screen.getByTestId("manuscript-preview"),
        "writing-manuscript-preview",
        manuscriptStyles.preview,
      ),
    ).toBe(true);
    expect(
      hasStableAndScopedClasses(
        document.querySelector(".writing-manuscript-preview__title"),
        "writing-manuscript-preview__title",
        manuscriptStyles.title,
      ),
    ).toBe(true);
    expect(
      hasStableAndScopedClasses(
        document.querySelector(".writing-manuscript-preview__meta"),
        "writing-manuscript-preview__meta",
        manuscriptStyles.meta,
      ),
    ).toBe(true);
    expect(
      hasStableAndScopedClasses(
        screen.getByTestId("manuscript-preview-grid"),
        "writing-manuscript-preview__grid",
        manuscriptStyles.grid,
      ),
    ).toBe(true);

    const sectionContracts = [
      ["intro", "도입 A", manuscriptStyles.intro],
      ["body", "전개 B", manuscriptStyles.body],
      ["conclusion", "마무리 C", manuscriptStyles.conclusion],
    ] as const;
    sectionContracts.forEach(([section, ariaLabel, scopedClass], index) => {
      expect(cells[index]?.getAttribute("data-section")).toBe(section);
      expect(cells[index]?.getAttribute("aria-label")).toBe(ariaLabel);
      expect(
        hasStableAndScopedClasses(
          cells[index],
          `writing-manuscript-preview__cell--${section}`,
          scopedClass,
        ),
      ).toBe(true);
      expect(cells[index]?.classList.contains(manuscriptStyles.cell)).toBe(
        true,
      );
    });
    expect(cells.slice(0, 3).map((cell) => cell.textContent)).toEqual([
      "A",
      "B",
      "C",
    ]);

    const expectOnlyHighlighted = (activeIndex: number) => {
      screen
        .getAllByTestId("manuscript-preview-cell")
        .slice(0, 3)
        .forEach((cell, index) => {
          const active = index === activeIndex;
          expect(cell.getAttribute("data-highlighted")).toBe(String(active));
          expect(
            hasStableAndScopedClasses(
              cell,
              "writing-manuscript-preview__cell--highlighted",
              manuscriptStyles.highlighted,
            ),
          ).toBe(active);
        });
    };

    expectOnlyHighlighted(0);

    rerender(renderPreview("body"));
    expectOnlyHighlighted(1);

    rerender(renderPreview("conclusion"));
    expectOnlyHighlighted(2);
  });
});
