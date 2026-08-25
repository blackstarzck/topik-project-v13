import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  findCssClassFamilySelectors,
  findCssClassPrefixSelectors,
} from "../../test-utils/cssClassFamily";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

const retiredLegacyClassPrefixes = [
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
const retiredClassFamilies = ["landing-layout-visual__grid"] as const;

describe("retired landing CSS contract", () => {
  test("keeps obsolete pre-layout landing selectors out of global CSS", () => {
    expect(
      findCssClassPrefixSelectors(globalCss, retiredLegacyClassPrefixes),
    ).toEqual([]);
    expect(
      findCssClassFamilySelectors(globalCss, retiredClassFamilies),
    ).toEqual([]);
  });

  test("matches retired class tokens without rejecting deceptive near-names", () => {
    expect(
      findCssClassFamilySelectors(
        ".landing-layout-visual__gridline { display: grid; }",
        ["landing-layout-visual__grid"],
      ),
    ).toEqual([]);
    expect(
      findCssClassFamilySelectors(
        `.scope .landing-layout-visual__grid:hover { display: grid; }
        .scope .landing-layout-visual__grid__cell:focus-visible { display: block; }
        .landing-layout-visual__grid--chart { display: grid; }`,
        ["landing-layout-visual__grid"],
      ),
    ).toEqual([
      ".scope .landing-layout-visual__grid:hover",
      ".scope .landing-layout-visual__grid__cell:focus-visible",
      ".landing-layout-visual__grid--chart",
    ]);
  });

  test("continues to reject single-hyphen descendants of legacy prefixes", () => {
    expect(
      findCssClassPrefixSelectors(
        ".scope .landing-footer-brand-new:hover { display: block; }",
        ["landing-footer"],
      ),
    ).toEqual([".scope .landing-footer-brand-new:hover"]);
  });

  test("preserves the live public hero and landing layout selectors", () => {
    expect(globalCss).toContain(".landing-hero-stage {");
    expect(globalCss).toContain(".landing-layout-wrap {");
    expect(globalCss).toContain(".landing-layout-footer {");
  });
});
