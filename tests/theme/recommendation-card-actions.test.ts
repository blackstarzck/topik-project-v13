import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const globalCss = readFileSync(
  path.resolve(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const recommendationCardsSource = readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/practice/RecommendationItemCards.tsx",
  ),
  "utf8",
);

describe("secondary recommendation card CTA", () => {
  test("uses layout utilities instead of a page-specific global selector", () => {
    expect(recommendationCardsSource).toContain(
      'className="inline-flex items-center justify-center gap-2"',
    );
    expect(globalCss).not.toMatch(
      /\.recommendation-card__continue-button\s*\{/,
    );
  });
});
