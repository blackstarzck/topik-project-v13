import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { findCssClassFamilySelectors } from "../test-utils/cssClassFamily";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return globalCss.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
}

describe("D-M2 analysis loading style contract", () => {
  test("keeps the retired submitted-answer background family out of global CSS", () => {
    expect(
      findCssClassFamilySelectors(globalCss, ["analysis-loading-background"]),
    ).toEqual([]);
  });

  test("matches retired class tokens without rejecting deceptive near-names", () => {
    expect(
      findCssClassFamilySelectors(
        ".analysis-loading-backgroundless { opacity: 1; }",
        ["analysis-loading-background"],
      ),
    ).toEqual([]);
    expect(
      findCssClassFamilySelectors(
        `.scope .analysis-loading-background:hover { opacity: 1; }
        .scope .analysis-loading-background__answer:focus-visible { opacity: 1; }
        .analysis-loading-background--compact { opacity: 1; }`,
        ["analysis-loading-background"],
      ),
    ).toEqual([
      ".scope .analysis-loading-background:hover",
      ".scope .analysis-loading-background__answer:focus-visible",
      ".analysis-loading-background--compact",
    ]);
  });

  test("finished analysis step check icons use filled contrast treatment", () => {
    expect(globalCss).toContain(
      ".analysis-loading--page .analysis-loading__steps .ant-steps-item-icon",
    );
    expect(globalCss).toContain("background-color 0.18s ease");
    expect(globalCss).toContain(".ant-steps-item-finish");
    expect(globalCss).toContain("background-color: var(--app-color-primary);");
    expect(globalCss).toContain("border-color: var(--app-color-primary);");
    expect(globalCss).toContain("color: var(--app-color-bg-container);");
  });

  test("submitted analysis page centers one non-card status panel", () => {
    const pageRule = cssRule(".submitted-analysis-page");
    const statusRule = cssRule(".submitted-analysis-page__status");
    const statePanelRule = cssRule(".analysis-state-card");

    expect(pageRule).toContain("place-items: center;");
    expect(pageRule).not.toContain("grid-template-columns");
    expect(statusRule).toContain("width: min(100%, 640px);");
    expect(statePanelRule).toContain("border: 0;");
    expect(statePanelRule).toContain("background: transparent;");
  });

  test("page analysis steps stay horizontal on mobile", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src",
        "components",
        "feedback",
        "AnalysisLoadingModal.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("responsive={false}");
    expect(globalCss).toContain("@media (max-width: 560px)");
    const mobileStepsRule = cssRule(
      ".analysis-loading--page .analysis-loading__steps.ant-steps",
    );

    expect(mobileStepsRule).toContain("flex-wrap: nowrap;");
    expect(mobileStepsRule).toContain("min-width: 0;");
  });
});
