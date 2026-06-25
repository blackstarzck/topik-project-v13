// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisLoadingPage } from "../../../src/components/feedback/AnalysisLoadingModal";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: routerMocks.back,
    push: routerMocks.push,
    replace: routerMocks.replace,
  }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  routerMocks.back.mockReset();
  routerMocks.push.mockReset();
  routerMocks.replace.mockReset();
});

describe("AnalysisLoadingPage state assets", () => {
  it.each([
    ["pending", "/assets/state/refresh.svg"],
    ["analyzing", "/assets/state/refresh.svg"],
    ["complete", "/assets/state/success.svg"],
    ["failed", "/assets/state/fail.svg"],
  ] as const)(
    "uses the matching state illustration for the %s status card",
    async (status, expectedAsset) => {
      renderWithIntl(
        <AnalysisLoadingPage
          status={status}
          onRetry={status === "failed" ? vi.fn() : undefined}
        />,
      );

      expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
      const stateAsset = screen.getByTestId(
        "analysis-state-asset",
      ) as HTMLImageElement;

      expect(screen.getByTestId("analysis-state-card")).toBeTruthy();
      expect(stateAsset.getAttribute("src")).toBe(expectedAsset);
    },
  );

  it("places the failure CTA below the state illustration", async () => {
    renderWithIntl(<AnalysisLoadingPage status="failed" onRetry={vi.fn()} />);

    expect(await screen.findByTestId("analysis-loading-panel")).toBeTruthy();
    expect(
      screen.getByTestId("analysis-failed-description").querySelector("br"),
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

  it("offers a library status handoff when analysis stays slow", async () => {
    vi.useFakeTimers();
    renderWithIntl(<AnalysisLoadingPage status="analyzing" />);

    expect(screen.getByTestId("analysis-loading-panel")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    const libraryButton = screen.getByRole("button", {
      name: "내 서재에서 상태 보기",
    });
    fireEvent.click(libraryButton);

    expect(routerMocks.push).toHaveBeenCalledWith("/library");
  });

  it("shows a stored pending handoff immediately when polling attempts are exhausted", async () => {
    renderWithIntl(<AnalysisLoadingPage status="analyzing" pollingExhausted />);

    expect(
      await screen.findByTestId("analysis-polling-exhausted"),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("analysis-library-status-link"));

    expect(routerMocks.push).toHaveBeenCalledWith("/library");
  });
});
