import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/global.css"),
  "utf8",
);

describe("secondary recommendation card CTA", () => {
  test("keeps the continue icon and label in one vertically centered row", () => {
    const buttonRule = globalCss.match(
      /\.recommendation-card__continue-button\s*\{([^}]*)\}/,
    )?.[1];

    expect(buttonRule).toBeDefined();
    expect(buttonRule).toMatch(/display:\s*inline-flex/);
    expect(buttonRule).toMatch(/align-items:\s*center/);
    expect(buttonRule).toMatch(/justify-content:\s*center/);
  });
});
