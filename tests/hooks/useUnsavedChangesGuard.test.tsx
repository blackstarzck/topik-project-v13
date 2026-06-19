// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangesGuard } from "../../src/hooks/useUnsavedChangesGuard";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

function GuardHarness({ when }: { when: boolean }) {
  const guard = useUnsavedChangesGuard({
    when,
    fallbackHref: "/practice/problems",
  });

  return (
    <div>
      <a href="/dashboard">Dashboard</a>
      <button type="button" onClick={() => guard.requestNavigation("/practice/problems")}>
        Back
      </button>
      <button type="button" onClick={guard.cancelPendingNavigation}>
        Cancel
      </button>
      <button type="button" onClick={guard.proceedPendingNavigation}>
        Proceed
      </button>
      <span data-testid="pending-kind">{guard.pendingNavigation?.kind ?? "none"}</span>
      <span data-testid="pending-href">
        {guard.pendingNavigation?.kind === "href" ? guard.pendingNavigation.href : ""}
      </span>
    </div>
  );
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    pushMock.mockClear();
    window.history.pushState(null, "", "/writing/short-answer-writing-51");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("allows UI navigation immediately when there is no unsaved answer change", () => {
    render(<GuardHarness when={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
    expect(screen.getByTestId("pending-kind").textContent).toBe("none");
  });

  it("captures UI navigation while an answer change is unsaved", () => {
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-kind").textContent).toBe("href");
    expect(screen.getByTestId("pending-href").textContent).toBe("/practice/problems");
  });

  it("captures same-origin link clicks while an answer change is unsaved", () => {
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-kind").textContent).toBe("href");
    expect(screen.getByTestId("pending-href").textContent).toBe("/dashboard");
  });

  it("cancels or proceeds with a pending href navigation", () => {
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("pending-kind").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
    expect(screen.getByTestId("pending-kind").textContent).toBe("none");
  });

  it("uses native beforeunload prevention only when an answer change is unsaved", () => {
    const { rerender } = render(<GuardHarness when={false} />);
    const cleanEvent = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    rerender(<GuardHarness when />);
    const dirtyEvent = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it("captures browser history back attempts while an answer change is unsaved", () => {
    render(<GuardHarness when />);

    fireEvent.popState(window);

    expect(screen.getByTestId("pending-kind").textContent).toBe("history");
  });
});
