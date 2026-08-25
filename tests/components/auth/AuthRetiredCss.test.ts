import { readFileSync } from "node:fs";
import path from "node:path";

import postcss from "postcss";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

const retiredClassNames = [
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
] as const;

describe("retired auth CSS contract", () => {
  test("keeps obsolete card-layout sign-up selectors out of global CSS", () => {
    const root = postcss.parse(globalCss, { from: "src/styles/global.css" });
    const retiredSelectors: string[] = [];

    root.walkRules((rule) => {
      const classNames = Array.from(
        rule.selector.matchAll(/\.([A-Za-z_-][\w-]*)/gu),
        (match) => match[1],
      );

      if (
        classNames.some((className) =>
          retiredClassNames.includes(
            className as (typeof retiredClassNames)[number],
          ),
        )
      ) {
        retiredSelectors.push(rule.selector);
      }
    });

    expect(retiredSelectors).toEqual([]);
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
