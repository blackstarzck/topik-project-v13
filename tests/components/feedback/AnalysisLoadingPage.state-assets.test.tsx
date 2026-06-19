// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisLoadingPage } from "../../../src/components/feedback/AnalysisLoadingModal";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: routerMocks.back,
    replace: routerMocks.replace,
  }),
}));

afterEach(() => cleanup());

describe("AnalysisLoadingPage state assets", () => {
  it("uses the refresh state illustration while analysis is active", async () => {
    renderWithIntl(<AnalysisLoadingPage status="analyzing" />);

    expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
    const stateAsset = screen.getByTestId(
      "analysis-state-asset",
    ) as HTMLImageElement;

    expect(screen.getByTestId("analysis-state-card")).toBeTruthy();
    expect(stateAsset.getAttribute("src")).toBe("/assets/state/refresh.svg");
  });

  it("uses the failure state illustration and places CTA below it", async () => {
    renderWithIntl(<AnalysisLoadingPage status="failed" onRetry={vi.fn()} />);

    expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
    expect(
      screen
        .getByTestId("analysis-failed-description")
        .querySelector("br"),
    ).toBeTruthy();
    const stateAsset = screen.getByTestId(
      "analysis-state-asset",
    ) as HTMLImageElement;
    const actions = screen.getByTestId("analysis-state-actions");

    expect(stateAsset.getAttribute("src")).toBe("/assets/state/fail.svg");
    expect(
      stateAsset.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses the success state illustration before redirecting to feedback", async () => {
    renderWithIntl(<AnalysisLoadingPage status="complete" />);

    expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
    const stateAsset = screen.getByTestId(
      "analysis-state-asset",
    ) as HTMLImageElement;

    expect(stateAsset.getAttribute("src")).toBe("/assets/state/success.svg");
  });
});
