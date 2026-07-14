import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/global.css"),
  "utf8",
);

describe("secondary recommendation card CTA", () => {
  test("does not add a page-specific global selector", () => {
    expect(globalCss).not.toMatch(
      /\.recommendation-card__continue-button\s*\{/,
    );
  });
});
