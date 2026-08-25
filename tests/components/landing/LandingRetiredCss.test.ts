import { readFileSync } from "node:fs";
import path from "node:path";

import postcss from "postcss";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

const retiredClassPrefixes = [
  "landing-bento-grid",
  "landing-capability",
  "landing-content-shell",
  "landing-eyebrow",
  "landing-feature-card",
  "landing-feature-copy",
  "landing-final-actions",
  "landing-final-cta",
  "landing-image-placeholder",
  "landing-icon-badge",
  "landing-outline-link",
  "landing-plain-button",
  "landing-plain-link",
  "landing-platform-",
  "landing-quote-section",
  "landing-section",
  "landing-split-copy",
  "landing-steps-layout",
  "landing-trust-card",
  "landing-trust-grid",
  "landing-step-list",
  "landing-footer",
] as const;

describe("retired landing CSS contract", () => {
  test("keeps obsolete pre-layout landing selectors out of global CSS", () => {
    const root = postcss.parse(globalCss, { from: "src/styles/global.css" });
    const retiredSelectors: string[] = [];

    root.walkRules((rule) => {
      const classNames = Array.from(
        rule.selector.matchAll(/\.([A-Za-z_-][\w-]*)/gu),
        (match) => match[1],
      );

      if (
        classNames.some((className) =>
          retiredClassPrefixes.some((prefix) => className.startsWith(prefix)),
        )
      ) {
        retiredSelectors.push(rule.selector);
      }
    });

    expect(retiredSelectors).toEqual([]);
  });

  test("preserves the live public hero and landing layout selectors", () => {
    expect(globalCss).toContain(".landing-hero-stage {");
    expect(globalCss).toContain(".landing-layout-wrap {");
    expect(globalCss).toContain(".landing-layout-footer {");
  });
});
