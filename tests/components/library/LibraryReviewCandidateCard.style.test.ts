import { readFileSync } from "node:fs";
import { join } from "node:path";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const moduleCss = readFileSync(
  join(
    process.cwd(),
    "src/components/library/LibraryReviewCandidateCard.module.css",
  ),
  "utf8",
);

function declarationsForSelector(source: string, selector: string) {
  const declarations: Record<string, string> = {};

  postcss.parse(source).walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((declaration) => {
      declarations[declaration.prop] = declaration.value;
    });
  });

  return declarations;
}

describe("LibraryReviewCandidateCard score progress styles", () => {
  it("moves the complete four-rule family out of the global stylesheet", () => {
    const globalSelectors: string[] = [];
    const moduleSelectors: string[] = [];
    postcss.parse(globalCss).walkRules((rule) => {
      if (rule.selector.includes("library-review-candidate-score-progress")) {
        globalSelectors.push(rule.selector);
      }
    });
    postcss.parse(moduleCss).walkRules((rule) => {
      moduleSelectors.push(rule.selector);
    });

    expect(globalSelectors).toEqual([]);
    expect(moduleSelectors).toEqual([
      ".scoreProgress",
      ".scoreProgress::-webkit-progress-bar",
      ".scoreProgress::-webkit-progress-value",
      ".scoreProgress::-moz-progress-bar",
    ]);
    expect(declarationsForSelector(moduleCss, ".scoreProgress")).toEqual({
      appearance: "none",
      overflow: "hidden",
      border: "0",
      background: "var(--app-color-library-review-score-track)",
    });
    expect(
      declarationsForSelector(
        moduleCss,
        ".scoreProgress::-webkit-progress-bar",
      ),
    ).toEqual({
      background: "var(--app-color-library-review-score-track)",
    });
    expect(
      declarationsForSelector(
        moduleCss,
        ".scoreProgress::-webkit-progress-value",
      ),
    ).toEqual({ background: "var(--app-color-link-secondary)" });
    expect(
      declarationsForSelector(moduleCss, ".scoreProgress::-moz-progress-bar"),
    ).toEqual({ background: "var(--app-color-link-secondary)" });
  });
});
