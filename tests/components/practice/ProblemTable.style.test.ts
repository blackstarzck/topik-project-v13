// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProblemTable } from "../../../src/components/practice/ProblemTable";
import problemTableStyles from "../../../src/components/practice/ProblemTable.module.css";
import { findCssClassFamilySelectors } from "../../test-utils/cssClassFamily";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const css = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const problemTableSource = readFileSync(
  path.join(process.cwd(), "src", "components", "practice", "ProblemTable.tsx"),
  "utf8",
);
const problemTableStylesPath = path.join(
  process.cwd(),
  "src",
  "components",
  "practice",
  "ProblemTable.module.css",
);
const problemTableStylesSource = existsSync(problemTableStylesPath)
  ? readFileSync(problemTableStylesPath, "utf8")
  : "";

const columnTitleModuleRules = [
  [
    ".columnTitle",
    "display: flex; width: 100%; align-items: center; gap: 6px; color: var(--app-color-text-secondary); font-size: 12px; font-weight: 500; line-height: 1.35; white-space: nowrap;",
  ],
  [".columnTitleCenter", "justify-content: center;"],
  [".columnTitleProblem", "justify-content: flex-start; padding-left: 66px;"],
  [
    ".columnTitleIcon",
    "display: inline-flex; flex: 0 0 auto; color: var(--app-color-text-secondary);",
  ],
  [".columnTitleIcon svg", "stroke-width: 1.8;"],
] as const;
const formerGlobalColumnTitleSelectors = [
  ".problem-table__column-title",
  ".problem-table__column-title--center",
  ".problem-table__column-title--problem",
  ".problem-table__column-title-icon",
  ".problem-table__column-title-icon svg",
] as const;
const retiredStatusPillClassFamilies = ["problem-table__status-pill"] as const;

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

type ParsedCssRule = {
  declarations: string;
  depth: number;
  selector: string;
  selectors: string[];
};

function normalizeCssSelector(selector: string) {
  return selector.replace(/\s+/gu, " ").trim();
}

function parseCssRules(source: string): ParsedCssRule[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//gu, "");

  function parseBlock(block: string, depth: number): ParsedCssRule[] {
    const rules: ParsedCssRule[] = [];
    let cursor = 0;

    while (cursor < block.length) {
      const openingBrace = block.indexOf("{", cursor);
      if (openingBrace < 0) break;

      const selector = block.slice(cursor, openingBrace).trim();
      let braceDepth = 1;
      let closingBrace = openingBrace + 1;
      while (closingBrace < block.length && braceDepth > 0) {
        if (block[closingBrace] === "{") braceDepth += 1;
        if (block[closingBrace] === "}") braceDepth -= 1;
        closingBrace += 1;
      }
      if (braceDepth !== 0) break;

      const declarations = block.slice(openingBrace + 1, closingBrace - 1);
      if (selector.startsWith("@")) {
        rules.push(...parseBlock(declarations, depth + 1));
      } else if (selector) {
        const normalizedSelector = normalizeCssSelector(selector);
        rules.push({
          declarations,
          depth,
          selector: normalizedSelector,
          selectors: normalizedSelector
            .split(",")
            .map((part) => normalizeCssSelector(part)),
        });
      }
      cursor = closingBrace;
    }

    return rules;
  }

  return parseBlock(withoutComments, 0);
}

function canonicalDeclarations(source: string) {
  return source
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      return [
        declaration.slice(0, separator).trim().toLowerCase(),
        declaration
          .slice(separator + 1)
          .replace(/\s+/gu, " ")
          .trim(),
      ] as const;
    })
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      `${leftName}:${leftValue}`.localeCompare(`${rightName}:${rightValue}`),
    );
}

function hasExactTopLevelRule(
  source: string,
  selector: string,
  expectedDeclarations: string,
) {
  const normalizedSelector = normalizeCssSelector(selector);
  const matches = parseCssRules(source).filter((rule) =>
    rule.selectors.includes(normalizedSelector),
  );

  return (
    matches.length === 1 &&
    matches[0].depth === 0 &&
    matches[0].selectors.length === 1 &&
    matches[0].selector === normalizedSelector &&
    JSON.stringify(canonicalDeclarations(matches[0].declarations)) ===
      JSON.stringify(canonicalDeclarations(expectedDeclarations))
  );
}

function hasCssSelector(source: string, selector: string) {
  const normalizedSelector = normalizeCssSelector(selector);

  return parseCssRules(source).some((rule) =>
    rule.selectors.includes(normalizedSelector),
  );
}

const questionNeonAssets = [
  [51, "neon-yellow.png"],
  [52, "neon-blue.png"],
  [53, "neon-orange.png"],
  [54, "neon-purple.png"],
] as const;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ProblemTable styles", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("keeps title, difficulty, estimated time, and previous score cells at 16px", () => {
    for (const selector of [".problem-table__title", ".problem-table__value"]) {
      expect(fontSize(selector)).toBe("16px");
    }

    expect(fontSize(".problem-table__type-index--number")).toBe("36px");
  });

  test("sources the table border from the shared secondary border token", () => {
    expect(problemTableSource).toContain(
      'borderColor: "var(--app-color-border-secondary)"',
    );
    expect(problemTableSource).not.toContain(
      'borderColor:\n        "color-mix(in srgb, var(--app-color-border) 35%, transparent)"',
    );
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

  test("keeps the retired status-pill family out of global CSS", () => {
    expect(
      findCssClassFamilySelectors(css, retiredStatusPillClassFamilies),
    ).toEqual([]);
  });

  test("matches retired class tokens without rejecting deceptive near-names", () => {
    expect(
      findCssClassFamilySelectors(
        ".problem-table__status-pillbox { display: inline-flex; }",
        ["problem-table__status-pill"],
      ),
    ).toEqual([]);
    expect(
      findCssClassFamilySelectors(
        `.scope .problem-table__status-pill:hover { display: inline-flex; }
        .scope .problem-table__status-pill__icon:focus-visible { display: block; }
        .problem-table__status-pill--completed { display: inline-flex; }`,
        ["problem-table__status-pill"],
      ),
    ).toEqual([
      ".scope .problem-table__status-pill:hover",
      ".scope .problem-table__status-pill__icon:focus-visible",
      ".problem-table__status-pill--completed",
    ]);
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

  test("keeps column title layout owned by the rendering component", () => {
    const missingContracts = [
      ...(!existsSync(problemTableStylesPath) ? ["component stylesheet"] : []),
      ...(!problemTableSource.includes(
        'import styles from "./ProblemTable.module.css";',
      )
        ? ["component stylesheet import"]
        : []),
      ...columnTitleModuleRules
        .filter(
          ([selector, declarations]) =>
            !hasExactTopLevelRule(
              problemTableStylesSource,
              selector,
              declarations,
            ),
        )
        .map(([selector]) => `module rule: ${selector}`),
      ...formerGlobalColumnTitleSelectors
        .filter((selector) => hasCssSelector(css, selector))
        .map((selector) => `global selector: ${selector}`),
    ];

    expect(missingContracts).toEqual([]);
    expect(problemTableStyles).toBeDefined();
    if (!problemTableStyles) return;

    const { container } = renderWithIntl(
      createElement(ProblemTable, {
        rows: [],
        userId: "user-1",
        returnTo: "/practice/problems",
        onRetryClick: vi.fn(),
      }),
    );
    const problemTitles = Array.from(
      container.querySelectorAll(".problem-table__column-title--problem"),
    );
    const centeredTitles = Array.from(
      container.querySelectorAll(".problem-table__column-title--center"),
    );
    const titleIcons = Array.from(
      container.querySelectorAll(".problem-table__column-title-icon"),
    );

    expect(problemTitles.length).toBeGreaterThan(0);
    for (const title of problemTitles) {
      expect(title.classList.contains("problem-table__column-title")).toBe(
        true,
      );
      expect(title.classList.contains(problemTableStyles.columnTitle)).toBe(
        true,
      );
      expect(
        title.classList.contains(problemTableStyles.columnTitleProblem),
      ).toBe(true);
      expect(
        title.classList.contains(problemTableStyles.columnTitleCenter),
      ).toBe(false);
    }
    expect(centeredTitles.length).toBeGreaterThan(0);
    for (const title of centeredTitles) {
      expect(title.classList.contains("problem-table__column-title")).toBe(
        true,
      );
      expect(title.classList.contains(problemTableStyles.columnTitle)).toBe(
        true,
      );
      expect(
        title.classList.contains(problemTableStyles.columnTitleCenter),
      ).toBe(true);
      expect(
        title.classList.contains(problemTableStyles.columnTitleProblem),
      ).toBe(false);
    }
    expect(titleIcons).toHaveLength(
      problemTitles.length + centeredTitles.length,
    );
    for (const icon of titleIcons) {
      expect(icon.classList.contains(problemTableStyles.columnTitleIcon)).toBe(
        true,
      );
    }
  });

  test("distinguishes top-level ownership from nested, duplicate, and grouped rules", () => {
    const expected = "display: flex; width: 100%;";

    expect(
      hasExactTopLevelRule(
        `@media (max-width: 600px) { .columnTitle { ${expected} } }`,
        ".columnTitle",
        expected,
      ),
    ).toBe(false);
    expect(
      hasExactTopLevelRule(
        `.columnTitle { width: 100%; /* order is irrelevant */ display: flex; }
        .columnTitle { display: block; }`,
        ".columnTitle",
        expected,
      ),
    ).toBe(false);
    expect(
      hasExactTopLevelRule(
        `.columnTitle { width: 100%; /* order is irrelevant */ display: flex; }`,
        ".columnTitle",
        expected,
      ),
    ).toBe(true);
    expect(
      hasExactTopLevelRule(
        `.columnTitle { width: 100%; display: flex; }
        @media (max-width: 600px) { .columnTitle { display: block; } }`,
        ".columnTitle",
        expected,
      ),
    ).toBe(false);
    expect(
      hasCssSelector(
        `@media (max-width: 600px) { .problem-table__column-title { display: block; } }`,
        ".problem-table__column-title",
      ),
    ).toBe(true);
    expect(
      hasCssSelector(
        `.problem-table__column-title-icon
          svg { stroke-width: 1.8; }`,
        ".problem-table__column-title-icon svg",
      ),
    ).toBe(true);
    expect(
      hasExactTopLevelRule(
        `.columnTitleIcon { flex: 0   0 auto; }`,
        ".columnTitleIcon",
        "flex: 0 0 auto;",
      ),
    ).toBe(true);
  });
});
