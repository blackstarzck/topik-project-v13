import { readFileSync } from "node:fs";
import { join } from "node:path";

import postcss from "postcss";
import { describe, expect, test } from "vitest";

// @ts-expect-error The executable UI contract scanner is intentionally plain ESM.
import { scanUiContract } from "../../../scripts/lib/ui-contract.mjs";

const globalCss = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const pageSource = readFileSync(
  join(process.cwd(), "src/app/page.tsx"),
  "utf8",
);
const headerSource = readFileSync(
  join(process.cwd(), "src/components/landing/LandingHeader.tsx"),
  "utf8",
);
const heroSource = readFileSync(
  join(process.cwd(), "src/components/landing/Hero.tsx"),
  "utf8",
);

function declarationValues(selector: string, property: string) {
  const values: string[] = [];

  postcss.parse(globalCss).walkRules((rule) => {
    if (rule.parent?.type !== "root") return;
    if (
      !rule.selector
        .split(",")
        .map((value) => value.trim())
        .includes(selector)
    ) {
      return;
    }

    rule.walkDecls(property, (declaration) => values.push(declaration.value));
  });

  return values;
}

const auditedPaintDeclarations = [
  [
    ".landing-public-shell",
    "background",
    "var(--app-color-landing-hero-outer-canvas)",
  ],
  [
    ".landing-hero-stage",
    "background-color",
    "var(--app-color-landing-hero-media-fallback)",
  ],
  [
    ".landing-hero-video",
    "background-color",
    "var(--app-color-landing-hero-media-fallback)",
  ],
  [
    ".landing-header",
    "background",
    "var(--app-color-landing-hero-header-surface)",
  ],
  [
    ".landing-header-link",
    "color",
    "var(--app-color-landing-hero-header-foreground)",
  ],
  [
    ".landing-header-link:hover",
    "color",
    "var(--app-color-landing-hero-header-hover)",
  ],
  [".landing-hero-kicker", "color", "var(--app-color-landing-hero-kicker)"],
  [
    ".landing-hero-title.ant-typography",
    "color",
    "var(--app-color-landing-hero-foreground)",
  ],
  [
    ".landing-hero-body.ant-typography",
    "color",
    "var(--app-color-landing-hero-body)",
  ],
] as const;

describe("live landing hero and header style contract", () => {
  test("resolves the exact audited ten raw declarations through eight semantic roles or deletion", () => {
    expect(auditedPaintDeclarations).toHaveLength(9);

    for (const [selector, property, value] of auditedPaintDeclarations) {
      expect(
        declarationValues(selector, property),
        `${selector} ${property}`,
      ).toEqual([value]);
    }

    expect(declarationValues(".landing-header", "box-shadow")).toEqual([]);
    expect(
      auditedPaintDeclarations.length +
        (declarationValues(".landing-header", "box-shadow").length === 0
          ? 1
          : 0),
    ).toBe(10);
  });

  test("keeps image-logo hover free from ineffective text paint", () => {
    expect(declarationValues(".landing-header-logo:hover", "color")).toEqual(
      [],
    );
    expect(declarationValues(".landing-header-logo:hover", "opacity")).toEqual([
      "0.72",
    ]);
  });

  test("clears the exact audited hero and header scanner cluster", () => {
    const start = globalCss.indexOf(".landing-public-shell");
    const end = globalCss.indexOf(".landing-layout-wrap", start);
    const violations = scanUiContract([
      {
        path: "landing-hero-header.css",
        content: globalCss.slice(start, end),
      },
    ]).violations.filter(({ ruleId }: { ruleId: string }) =>
      ["visual.raw-color", "visual.raw-radius-shadow-font"].includes(ruleId),
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(violations).toEqual([]);
  });

  test("keeps every tokenized selector connected to its live owner", () => {
    for (const className of [
      "landing-public-shell",
      "landing-hero-stage",
      "landing-hero-video",
    ]) {
      expect(pageSource, className).toContain(className);
    }
    for (const className of [
      "landing-header",
      "landing-header-link",
      "landing-header-logo",
    ]) {
      expect(headerSource, className).toContain(className);
    }
    for (const className of [
      "landing-hero-kicker",
      "landing-hero-title",
      "landing-hero-body",
    ]) {
      expect(heroSource, className).toContain(className);
    }
  });
});
