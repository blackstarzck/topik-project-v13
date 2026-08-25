import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { findCssClassFamilySelectors } from "../../test-utils/cssClassFamily";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

const retiredClassFamilies = [
  "signup-public-shell",
  "signup-page",
  "signup-shell-card",
  "signup-hero-panel",
  "signup-form-panel",
  "signup-hero-copy",
  "signup-eyebrow",
  "signup-mascot-row",
  "signup-mascot-row--characters",
  "signup-mascot-figure",
  "signup-mascot-figure--characters",
  "signup-mascot-note",
  "signup-benefit-strip",
  "signup-benefit",
  "signup-benefit__icon",
  "signup-login-prompt",
  "signup-form-heading",
  "signup-chip-row",
  "signup-brand__mark",
] as const;

describe("retired auth CSS contract", () => {
  test("keeps obsolete card-layout sign-up selectors out of global CSS", () => {
    expect(
      findCssClassFamilySelectors(globalCss, retiredClassFamilies),
    ).toEqual([]);
  });

  test("matches retired class tokens without rejecting deceptive near-names", () => {
    expect(
      findCssClassFamilySelectors(
        ".signup-brand__marker { display: inline-flex; }",
        ["signup-brand__mark"],
      ),
    ).toEqual([]);
    expect(
      findCssClassFamilySelectors(
        `.scope .signup-brand__mark:hover { display: inline-flex; }
        .scope .signup-brand__mark__glyph:focus-visible { display: block; }
        .signup-brand__mark--compact { display: inline-flex; }`,
        ["signup-brand__mark"],
      ),
    ).toEqual([
      ".scope .signup-brand__mark:hover",
      ".scope .signup-brand__mark__glyph:focus-visible",
      ".signup-brand__mark--compact",
    ]);
  });

  test("preserves the live auth prompt, character, form, and state selectors", () => {
    expect(globalCss).toContain(".signup-prompt-shell {");
    expect(globalCss).toContain(".signup-prompt-layout {");
    expect(globalCss).toContain(".signup-prompt-hero {");
    expect(globalCss).toContain(".signup-prompt-form-panel {");
    expect(globalCss).toContain(".signup-character-stage {");
    expect(globalCss).toContain(".signup-character--purple {");
    expect(globalCss).toContain(".signup-form-surface {");
    expect(globalCss).toContain(".signup-social-button.ant-btn {");
    expect(globalCss).toContain("@keyframes auth-progressive-step-in {");
    expect(globalCss).toContain(".ant-btn-primary:disabled");
    expect(globalCss).toContain(".ant-input-affix-wrapper-focused");
  });
});
