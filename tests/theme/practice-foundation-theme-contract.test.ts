import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { allowedAppBridgeVars, getResolvedBridgeVars } from "../../src/theme";
import { awesomicThemeTokens } from "../../src/theme/tokens/awesomic";
import { phase5dAlternateTheme } from "../e2e/fixtures/phase5d-alternate-theme";

const productionRoles = {
  "--app-radius-practice-retry-summary": "10px",
  "--app-radius-practice-retry-mode-option": "12px",
  "--app-color-library-review-score-track":
    "color-mix(in srgb, var(--app-color-border) 18%, var(--app-color-bg-container))",
  "--app-shadow-selectable-card-selected":
    "var(--app-shadow-elevated), 0 0 0 1.5px var(--app-color-primary) inset",
  "--app-font-question-number-display":
    '"Space Grotesk", var(--app-font-family), sans-serif',
  "--app-radius-problem-new-badge": "12px",
  "--app-color-problem-new-badge-surface":
    "color-mix(in srgb, var(--app-color-text-secondary) 12%, transparent)",
} as const;

const alternateRolesByAppearance = {
  light: {
    "--app-radius-practice-retry-summary": "13.75px",
    "--app-radius-practice-retry-mode-option": "17.25px",
    "--app-color-library-review-score-track": "#d9f7ff",
    "--app-shadow-selectable-card-selected":
      "0 10px 26px rgba(72, 34, 145, 0.24), inset 0 0 0 3px #ef42bd",
    "--app-font-question-number-display":
      '"Phase5D Question Display", var(--app-font-family), sans-serif',
    "--app-radius-problem-new-badge": "15.5px",
    "--app-color-problem-new-badge-surface": "rgba(239, 66, 189, 0.22)",
  },
  dark: {
    "--app-radius-practice-retry-summary": "13.75px",
    "--app-radius-practice-retry-mode-option": "17.25px",
    "--app-color-library-review-score-track": "#17354a",
    "--app-shadow-selectable-card-selected":
      "0 10px 26px rgba(0, 0, 0, 0.48), inset 0 0 0 3px #55e6c1",
    "--app-font-question-number-display":
      '"Phase5D Question Display", var(--app-font-family), sans-serif',
    "--app-radius-problem-new-badge": "15.5px",
    "--app-color-problem-new-badge-surface": "rgba(85, 230, 193, 0.24)",
  },
} as const;

describe("practice B-E theme foundation", () => {
  test("documents and registers exactly the seven plain-CSS roles", () => {
    const design = readFileSync(resolve(process.cwd(), "DESIGN.md"), "utf8");
    const foundation = readFileSync(
      resolve(process.cwd(), "src/styles/foundation.css"),
      "utf8",
    );

    for (const role of Object.keys(productionRoles)) {
      expect(allowedAppBridgeVars).toContain(role);
      expect(design).toContain(`\`${role}\``);
      expect(foundation).not.toContain(role);
    }
  });

  test("owns the seven current recipes in the Awesomic L1 source", () => {
    expect(awesomicThemeTokens.practiceRetry).toEqual({
      radius: { summary: 10, modeOption: 12 },
    });
    expect(awesomicThemeTokens.libraryReview.color.scoreTrack).toBe(
      productionRoles["--app-color-library-review-score-track"],
    );
    expect(awesomicThemeTokens.selectableCard.shadow.selected).toBe(
      productionRoles["--app-shadow-selectable-card-selected"],
    );
    expect(awesomicThemeTokens.questionNumber.font.display).toBe(
      productionRoles["--app-font-question-number-display"],
    );
    expect(awesomicThemeTokens.problemNewBadge).toEqual({
      color: {
        surface: productionRoles["--app-color-problem-new-badge-surface"],
      },
      radius: 12,
    });
  });

  test("preserves every Default and Awesomic appearance recipe", () => {
    for (const themeName of ["default", "awesomic"] as const) {
      for (const appearance of ["light", "dark"] as const) {
        expect(getResolvedBridgeVars(themeName, appearance)).toMatchObject(
          productionRoles,
        );
      }
    }
  });

  test("projects distinct alternate appearance values without production leakage", () => {
    for (const appearance of ["light", "dark"] as const) {
      expect(
        phase5dAlternateTheme.appBridgeVarsByAppearance[appearance],
      ).toMatchObject(alternateRolesByAppearance[appearance]);
    }

    for (const role of [
      "--app-color-library-review-score-track",
      "--app-shadow-selectable-card-selected",
      "--app-color-problem-new-badge-surface",
    ] as const) {
      expect(alternateRolesByAppearance.light[role]).not.toBe(
        alternateRolesByAppearance.dark[role],
      );
    }

    const productionDirectory = resolve(process.cwd(), "src");
    const alternateValues = [
      ...new Set(
        Object.values(alternateRolesByAppearance).flatMap(Object.values),
      ),
    ];
    const leaks = readdirSync(productionDirectory, {
      encoding: "utf8",
      recursive: true,
    })
      .filter((relativePath) =>
        [".css", ".ts", ".tsx"].includes(extname(relativePath)),
      )
      .flatMap((relativePath) => {
        const source = readFileSync(
          resolve(productionDirectory, relativePath),
          "utf8",
        );
        return alternateValues
          .filter((value) => source.includes(value))
          .map((value) => ({ relativePath, value }));
      });

    expect(leaks).toEqual([]);
  });
});
