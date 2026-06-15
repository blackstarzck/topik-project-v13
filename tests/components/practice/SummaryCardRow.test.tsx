// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SummaryCardRow } from "../../../src/components/practice/SummaryCardRow";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => {
  cleanup();
});

describe("SummaryCardRow", () => {
  it("keeps summary cards stretched to equal row height", () => {
    renderWithIntl(
      <SummaryCardRow
        recentSubmissions={5}
        averageScore={60}
        weakestDimensions={[
          { dimension: "grammar", score: 52 },
          { dimension: "content", score: 56 },
          { dimension: "expression", score: 58 },
        ]}
        estimatedMinutes={12}
        recommendedType="51"
      />,
    );

    const rowClassName = screen.getByTestId("next-summary-row").className;
    expect(rowClassName).toContain("grid");
    expect(rowClassName).toContain("auto-rows-fr");
    expect(rowClassName).toContain("md:grid-cols-3");

    const cards = screen.getAllByTestId("next-summary-card");
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.className).toContain("h-full");
      expect(card.className).toContain("w-full");
    }

    const values = screen.getAllByTestId("next-summary-value");
    expect(values).toHaveLength(3);
    for (const value of values) {
      expect(value.className).toContain("text-xl");
      expect(value.className).toContain("leading-7");
    }
  });
});
