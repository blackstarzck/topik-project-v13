// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { Writing53MaterialCards } from "../../../src/components/writing/Writing53MaterialCards";
import materialStyles from "../../../src/components/writing/Writing53MaterialCards.module.css";
import type { NormalizedMaterialCard } from "../../../src/lib/writing/problem-normalizer";
import {
  findGlobalCssOwners,
  hasStableAndScopedClasses,
  hasExactCssRule,
} from "./writing-style-contract";

afterEach(() => cleanup());

const cards: NormalizedMaterialCard[] = [
  {
    id: "chart_a",
    kind: "chart",
    title: "Service use rate",
    subtitle: "percent · Survey Center · 2022-2024",
    chart: {
      id: "chart_a",
      title: "Service use rate",
      chartType: "bar",
      unit: "percent",
      surveyOrg: "Survey Center",
      yearRange: [2022, 2023, 2024],
      series: [
        { label: "Use", values: [20, 30, 45] },
        { label: "No use", values: [80, 70, 55] },
      ],
    },
  },
  {
    id: "chart_b",
    kind: "chart",
    title: "Satisfaction by type",
    subtitle: "score 쨌 Survey Center 쨌 2024",
    chart: {
      id: "chart_b",
      title: "Satisfaction by type",
      chartType: "bar",
      unit: "score",
      surveyOrg: "Survey Center",
      yearRange: ["Home", "Facility"],
      series: [{ label: "Score", values: [78, 64] }],
    },
  },
  {
    id: "context_notes",
    kind: "reference",
    title: "Reference",
    subtitle: null,
    rows: [
      { label: "Cause", value: "Policy expansion" },
      { label: "Status", value: "Home care satisfaction is high" },
    ],
  },
];

describe("Writing53MaterialCards", () => {
  it("owns the chart surface layout without a global CSS dependency", () => {
    const modulePath = join(
      process.cwd(),
      "src/components/writing/Writing53MaterialCards.module.css",
    );
    const source = readFileSync(
      join(process.cwd(), "src/components/writing/Writing53MaterialCards.tsx"),
      "utf8",
    );
    expect(existsSync(modulePath)).toBe(true);
    if (!existsSync(modulePath)) return;

    const moduleCss = readFileSync(modulePath, "utf8");
    expect(
      hasExactCssRule(moduleCss, ".chartStack", "display: grid; gap: 12px;"),
    ).toBe(true);
    expect(
      hasExactCssRule(
        moduleCss,
        ".chart",
        "margin-inline-start: 0; width: 100%; min-height: 180px;",
      ),
    ).toBe(true);
    expect(
      hasExactCssRule(moduleCss, ".radialChart", "min-height: 156px;"),
    ).toBe(true);
    expect(source).toContain(
      'import styles from "./Writing53MaterialCards.module.css";',
    );
    expect(source).toContain(
      '"writing-material-chart-stack", styles.chartStack',
    );
    expect(source.match(/styles\.chart\b/gu)).toHaveLength(3);
    expect(source).toContain("styles.radialChart");
    expect(
      findGlobalCssOwners([
        "writing-material-chart-stack",
        "writing-material-chart",
        "writing-material-chart--radial",
      ]),
    ).toEqual([]);
  });

  it("renders chart materials and expands the cause descriptions across an empty row slot", () => {
    renderWithIntl(<Writing53MaterialCards cards={cards} />);

    expect(screen.getAllByText("Service use rate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Satisfaction by type").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Use")).toBeTruthy();
    expect(screen.getByText("Policy expansion")).toBeTruthy();
    expect(screen.queryByText("Reference")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Reference" })).toBeNull();
    expect(screen.getAllByTestId("q53-material-grid-cell")).toHaveLength(3);
    expect(screen.getAllByTestId("q53-material-data-card")).toHaveLength(2);
    expect(screen.getAllByTestId("q53-material-chart")).toHaveLength(2);
    expect(
      hasStableAndScopedClasses(
        screen.getAllByTestId("q53-material-value-list")[0]?.parentElement,
        "writing-material-chart-stack",
        materialStyles.chartStack,
      ),
    ).toBe(true);
    for (const chart of screen.getAllByTestId("q53-material-chart")) {
      expect(
        hasStableAndScopedClasses(
          chart,
          "writing-material-chart",
          materialStyles.chart,
        ),
      ).toBe(true);
    }
    expect(screen.queryByTestId("q53-material-placeholder")).toBeNull();

    const reference = screen.getByTestId("q53-material-reference");
    const referenceCell = reference.closest(".writing-material-card__cell");
    expect(
      referenceCell?.classList.contains(
        "writing-material-card__cell--reference",
      ),
    ).toBe(true);
    expect(
      referenceCell?.classList.contains(
        "writing-material-card__cell--span-row",
      ),
    ).toBe(true);
    expect(
      reference.querySelector(".writing-material-card__heading"),
    ).toBeNull();
    expect(reference.querySelector(".ant-descriptions")).toBeTruthy();
  });

  it("renders the empty material state when no cards are available", () => {
    renderWithIntl(<Writing53MaterialCards cards={[]} />);

    expect(screen.getByText("표시할 자료가 없습니다.")).toBeTruthy();
    expect(screen.queryAllByTestId("q53-material-data-card")).toHaveLength(0);
  });

  it("renders reference rows in the grid", () => {
    renderWithIntl(<Writing53MaterialCards cards={cards} />);

    expect(screen.getByText("Cause")).toBeTruthy();
    expect(screen.getByText("Policy expansion")).toBeTruthy();
    expect(screen.getByText("Home care satisfaction is high")).toBeTruthy();
  });

  it("does not render a fourth data card when more than three cards are passed", () => {
    renderWithIntl(
      <Writing53MaterialCards
        cards={[
          ...cards,
          {
            id: "extra",
            kind: "reference",
            title: "Extra",
            subtitle: null,
            rows: [{ label: "Extra label", value: "Extra value" }],
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId("q53-material-data-card")).toHaveLength(2);
    expect(screen.getByTestId("q53-material-reference")).toBeTruthy();
    expect(screen.queryByText("Extra")).toBeNull();
  });

  it("falls back to a value list for unknown chart types", () => {
    renderWithIntl(
      <Writing53MaterialCards
        cards={[
          {
            id: "chart_unknown",
            kind: "chart",
            title: "Unknown data",
            subtitle: null,
            warning: "chart_unrenderable",
            chart: {
              id: "chart_unknown",
              title: "Unknown data",
              chartType: "unknown",
              unit: null,
              surveyOrg: null,
              yearRange: ["A", "B"],
              series: [{ label: "Group", values: [1, 2] }],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId("q53-material-value-list")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("renders chart values as borderless lists with color bullets for radial and multi-series charts", () => {
    renderWithIntl(
      <Writing53MaterialCards
        cards={[
          {
            id: "chart_grouped",
            kind: "chart",
            title: "Grouped bar",
            subtitle: null,
            chart: {
              id: "chart_grouped",
              title: "Grouped bar",
              chartType: "bar",
              unit: "percent",
              surveyOrg: "Survey Center",
              yearRange: ["A", "B"],
              series: [
                { label: "2018", values: [44, 61] },
                { label: "2022", values: [57, 74] },
              ],
            },
          },
          {
            id: "chart_donut",
            kind: "chart",
            title: "Donut share",
            subtitle: null,
            chart: {
              id: "chart_donut",
              title: "Donut share",
              chartType: "donut",
              unit: "percent",
              surveyOrg: "Survey Center",
              yearRange: [2024],
              series: [
                { label: "Math", values: [19] },
                { label: "Science", values: [25] },
              ],
            },
          },
        ]}
      />,
    );

    const valueLists = screen.getAllByTestId("q53-material-value-list");
    expect(valueLists).toHaveLength(2);
    for (const valueList of valueLists) {
      expect(valueList.querySelector("table")).toBeNull();
      expect(valueList.classList.contains("writing-material-value-list")).toBe(
        true,
      );
    }
    expect(screen.getByText("2018")).toBeTruthy();
    expect(screen.getByText("A 44 · B 61")).toBeTruthy();
    expect(screen.getByText("Math")).toBeTruthy();
    expect(screen.getByText("19")).toBeTruthy();
    expect(screen.getAllByTestId("q53-material-value-bullet").length).toBe(4);
    const radialChart = screen
      .getAllByTestId("q53-material-chart")
      .find((chart) =>
        chart.classList.contains("writing-material-chart--radial"),
      );
    expect(
      hasStableAndScopedClasses(
        radialChart,
        "writing-material-chart--radial",
        materialStyles.radialChart,
      ),
    ).toBe(true);
  });
});
