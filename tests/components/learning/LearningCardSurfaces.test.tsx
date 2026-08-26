// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

import { AlertsCard } from "../../../src/components/learning/AlertsCard";
import { KpiCard } from "../../../src/components/learning/KpiCard";
import { RecommendationCard } from "../../../src/components/learning/RecommendationCard";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => {
  cleanup();
});

function expectSharedCardSurface(element: Element | null) {
  expect(element).toBeTruthy();
  expect(element?.classList.contains("app-card")).toBe(true);
  expect(element?.classList.contains("app-surface")).toBe(true);
}

describe("learning card surfaces", () => {
  it("routes alerts through the shared card surface", () => {
    const { container } = renderWithIntl(<AlertsCard alerts={[]} />);

    expectSharedCardSurface(container.querySelector(".ant-card"));
  });

  it("routes KPI values through the shared card surface", () => {
    const { container } = renderWithIntl(
      <KpiCard title="attempts" value={3} suffix="times" hint="today" />,
    );

    expectSharedCardSurface(container.querySelector(".ant-card"));
  });

  it("routes recommendations through the shared card surface", () => {
    const { container } = renderWithIntl(
      <RecommendationCard title="practice" ctaHref="/practice" />,
    );

    expectSharedCardSurface(container.querySelector(".ant-card"));
  });
});
