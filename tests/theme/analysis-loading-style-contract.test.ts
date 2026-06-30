import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

function cssRule(selector: string) {
  const css = readFileSync(
    path.join(process.cwd(), "src", "styles", "global.css"),
    "utf8",
  );
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
}

describe("D-M2 analysis loading style contract", () => {
  test("read-only submitted answer eyebrow uses description typography", () => {
    const eyebrowRule = cssRule(".analysis-loading-background__eyebrow");
    const antdEyebrowRule = cssRule(
      ".analysis-loading-background__eyebrow.ant-typography",
    );
    const metaRule = cssRule(
      ".analysis-loading-background__meta .ant-typography",
    );

    expect(eyebrowRule).toContain("color: var(--app-color-text-secondary);");
    expect(eyebrowRule).toContain("font-weight: 400;");
    expect(antdEyebrowRule).toContain(
      "color: var(--app-color-text-secondary);",
    );
    expect(metaRule).toContain("font-size: 12px;");
  });

  test("finished analysis step check icons use filled contrast treatment", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src", "styles", "global.css"),
      "utf8",
    );

    expect(css).toContain(
      ".analysis-loading--page .analysis-loading__steps .ant-steps-item-icon",
    );
    expect(css).toContain("background-color 0.18s ease");
    expect(css).toContain(".ant-steps-item-finish");
    expect(css).toContain("background-color: var(--app-color-primary);");
    expect(css).toContain("border-color: var(--app-color-primary);");
    expect(css).toContain("color: var(--app-color-bg-container);");
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
    const css = readFileSync(
      path.join(process.cwd(), "src", "styles", "global.css"),
      "utf8",
    );
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
    expect(css).toContain("@media (max-width: 560px)");
    const mobileStepsRule = cssRule(
      ".analysis-loading--page .analysis-loading__steps.ant-steps",
    );

    expect(mobileStepsRule).toContain("flex-wrap: nowrap;");
    expect(mobileStepsRule).toContain("min-width: 0;");
  });
});
