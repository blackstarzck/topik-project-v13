// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, screen } from "@testing-library/react";
import postcss, { type Declaration, type Root, type Rule } from "postcss";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ProblemTable } from "../../src/components/practice/ProblemTable";
import problemTableStyles from "../../src/components/practice/ProblemTable.module.css";
import type { UserProblemRow } from "../../src/components/practice/problem-list-data";
import { SelectableAppCard } from "../../src/components/shared/SelectableAppCard";
import { renderWithIntl } from "../test-utils/renderWithIntl";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const problemTableCss = readFileSync(
  path.join(
    process.cwd(),
    "src",
    "components",
    "practice",
    "ProblemTable.module.css",
  ),
  "utf8",
);
const globalStylesheet = postcss.parse(globalCss, {
  from: "src/styles/global.css",
});
const problemTableStylesheet = postcss.parse(problemTableCss, {
  from: "src/components/practice/ProblemTable.module.css",
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/library/mutations", () => ({
  isDuplicateLibrarySaveError: () => false,
  useDeleteProblemLibraryItem: () => ({ isPending: false, mutate: vi.fn() }),
  useSaveLibraryItem: () => ({ isPending: false, mutate: vi.fn() }),
}));

function normalizeSelector(selector: string) {
  return selector.replace(/\s+/gu, " ").trim();
}

function exactRootRule(stylesheet: Root, selector: string) {
  const matches: Rule[] = [];
  stylesheet.walkRules((rule) => {
    if (
      rule.parent?.type === "root" &&
      normalizeSelector(rule.selector) === selector
    ) {
      matches.push(rule);
    }
  });

  expect(matches, selector).toHaveLength(1);
  return matches[0];
}

function declaration(rule: Rule, property: string) {
  const matches = rule.nodes.filter(
    (node): node is Declaration =>
      node.type === "decl" && node.prop === property,
  );

  expect(matches, `${rule.selector} ${property}`).toHaveLength(1);
  return matches[0].value;
}

function directDeclarations(rule: Rule) {
  return Object.fromEntries(
    rule.nodes
      .filter((node): node is Declaration => node.type === "decl")
      .map((node) => [node.prop, node.value]),
  );
}

const newProblemRow = {
  problemId: "problem-new",
  title: "51-128_동의어 어휘 빈칸",
  domain: "vocabulary",
  topikLevel: 2,
  questionNo: 51,
  difficulty: 2,
  tags: [],
  attemptCount: 0,
  isSolved: false,
  lastAttemptAt: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  solveState: "none",
  latestSubmissionId: null,
  latestSubmissionAt: null,
  feedbackStatus: null,
  completedSubmissionCount: 0,
  submissionAttemptCount: 0,
  previousScore: null,
  lifecycleStatus: "active",
  lifecycleReason: null,
  publishStatus: "published",
  reviewStatus: "approved",
} satisfies UserProblemRow;

const ordinaryProblemRow = {
  ...newProblemRow,
  problemId: "problem-ordinary",
  title: "ordinary problem",
  questionNo: 52,
} satisfies UserProblemRow;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("remaining practice visual consumers", () => {
  test("keeps selected cards accessible while the semantic shadow owns paint", () => {
    const selectedRule = exactRootRule(
      globalStylesheet,
      ".selectable-app-card--selected",
    );
    const borderedOverride = exactRootRule(
      globalStylesheet,
      ".app-cards-bordered .selectable-app-card.app-surface.selectable-app-card--selected",
    );

    expect(declaration(selectedRule, "border-color")).toBe(
      "var(--app-color-primary)",
    );
    expect(declaration(selectedRule, "box-shadow")).toBe(
      "var(--app-shadow-selectable-card-selected)",
    );
    expect(declaration(borderedOverride, "border-color")).toBe(
      "var(--app-color-primary)",
    );

    renderWithIntl(
      <SelectableAppCard selected onSelect={() => undefined} title="choice">
        body
      </SelectableAppCard>,
    );
    const card = screen.getByRole("button", { name: /choice/i });
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(card.classList.contains("selectable-app-card--selected")).toBe(true);
  });

  test("uses one display-font role without changing question-number geometry or neon classes", () => {
    const expectedGeometry = {
      ".writing-question-number": {
        width: "52px",
        height: "52px",
        "font-size": "36px",
        "font-weight": "700",
        "font-variant-numeric": "tabular-nums",
      },
      ".library-problems-question-number": {
        width: "32px",
        height: "32px",
        "font-size": "18px",
        "font-weight": "700",
        "font-variant-numeric": "tabular-nums",
      },
      ".problem-table__type-index--number": {
        "font-size": "36px",
        "font-weight": "700",
        "font-variant-numeric": "tabular-nums",
      },
    } as const;

    for (const [selector, geometry] of Object.entries(expectedGeometry)) {
      const rule = exactRootRule(globalStylesheet, selector);
      expect(declaration(rule, "font-family")).toBe(
        "var(--app-font-question-number-display)",
      );
      for (const [property, value] of Object.entries(geometry)) {
        expect(declaration(rule, property)).toBe(value);
      }
      expect(declaration(rule, "background-position")).toBe("center");
      expect(declaration(rule, "background-repeat")).toBe("no-repeat");
      expect(declaration(rule, "background-size")).toBe("contain");
    }

    for (const [questionNo, asset] of [
      [51, "neon-yellow.png"],
      [52, "neon-blue.png"],
      [53, "neon-orange.png"],
      [54, "neon-purple.png"],
    ] as const) {
      for (const prefix of [
        ".writing-question-number",
        ".library-problems-question-number",
        ".problem-table__type-index",
      ]) {
        expect(
          declaration(
            exactRootRule(globalStylesheet, `${prefix}--q${questionNo}`),
            "background-image",
          ),
        ).toBe(`url("/assets/${asset}")`);
      }
    }
  });

  test("moves the new badge to its rendering component without changing its live condition", () => {
    const globalOwners: string[] = [];
    globalStylesheet.walkRules((rule) => {
      if (rule.selector.includes(".problem-table__new-badge")) {
        globalOwners.push(normalizeSelector(rule.selector));
      }
    });
    expect(globalOwners).toEqual([]);

    const moduleRule = exactRootRule(problemTableStylesheet, ".newBadge");
    expect(directDeclarations(moduleRule)).toEqual({
      display: "inline-flex",
      "min-height": "22px",
      "align-items": "center",
      "border-radius": "var(--app-radius-problem-new-badge)",
      background: "var(--app-color-problem-new-badge-surface)",
      padding: "0 9px",
      color: "var(--app-color-text)",
      "font-size": "12px",
      "font-weight": "700",
      "line-height": "1.5",
    });

    const { container } = renderWithIntl(
      <ProblemTable
        rows={[newProblemRow, ordinaryProblemRow]}
        userId="user-1"
        returnTo="/practice/problems"
        onRetryClick={vi.fn()}
      />,
    );
    const badges = container.querySelectorAll(".problem-table__new-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].classList.contains(problemTableStyles.newBadge)).toBe(
      true,
    );
  });
});
