// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangesGuard } from "../../src/hooks/useUnsavedChangesGuard";

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
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
      <button
        type="button"
        onClick={() =>
          guard.requestNavigation("/practice/problems", { mode: "replace" })
        }
      >
        Back
      </button>
      <button type="button" onClick={guard.cancelPendingNavigation}>
        Cancel
      </button>
      <button type="button" onClick={guard.proceedPendingNavigation}>
        Proceed
      </button>
      <span data-testid="pending-kind">
        {guard.pendingNavigation?.kind ?? "none"}
      </span>
      <span data-testid="pending-href">
        {guard.pendingNavigation?.kind === "href"
          ? guard.pendingNavigation.href
          : ""}
      </span>
      <span data-testid="pending-mode">
        {guard.pendingNavigation?.kind === "href"
          ? guard.pendingNavigation.mode
          : ""}
      </span>
    </div>
  );
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    window.history.pushState(null, "", "/writing/short-answer-writing-51");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("allows UI navigation immediately when there is no unsaved answer change", () => {
    render(<GuardHarness when={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(replaceMock).toHaveBeenCalledWith("/practice/problems");
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-kind").textContent).toBe("none");
  });

  it("captures UI navigation while an answer change is unsaved", () => {
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-kind").textContent).toBe("href");
    expect(screen.getByTestId("pending-href").textContent).toBe(
      "/practice/problems",
    );
    expect(screen.getByTestId("pending-mode").textContent).toBe("replace");
  });

  it("captures same-origin link clicks while an answer change is unsaved", () => {
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-kind").textContent).toBe("href");
    expect(screen.getByTestId("pending-href").textContent).toBe("/dashboard");
    expect(screen.getByTestId("pending-mode").textContent).toBe("push");
  });

  it("cancels or proceeds with a pending replace after removing the sentinel", () => {
    const back = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => undefined);
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("pending-kind").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
    fireEvent.popState(window);

    expect(replaceMock).toHaveBeenCalledWith("/practice/problems");
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-kind").textContent).toBe("none");
  });

  it("removes the sentinel before proceeding with a captured push link", () => {
    const back = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => undefined);
    render(<GuardHarness when />);

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    fireEvent.popState(window);

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(replaceMock).not.toHaveBeenCalled();
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

  it("uses native history when a captured browser back is approved", () => {
    const go = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => undefined);
    render(<GuardHarness when />);

    fireEvent.popState(window);
    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(go).toHaveBeenCalledWith(-2);
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("goes back one entry when autosave already removed the sentinel", () => {
    const back = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => undefined);
    const go = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => undefined);
    const { rerender } = render(<GuardHarness when />);

    fireEvent.popState(window);
    expect(screen.getByTestId("pending-kind").textContent).toBe("history");

    rerender(<GuardHarness when={false} />);
    expect(back).toHaveBeenCalledTimes(1);
    fireEvent.popState(window);
    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(go).toHaveBeenCalledWith(-1);
    expect(go).not.toHaveBeenCalledWith(-2);
  });

  it("preserves a URL normalized while the dirty-history sentinel is removed", () => {
    const back = vi
      .spyOn(window.history, "back")
      .mockImplementation(() => undefined);
    window.history.replaceState(
      null,
      "",
      "/writing/short-answer-writing-51?problem=problem-1&fresh=1",
    );
    const { rerender } = render(<GuardHarness when />);
    window.history.replaceState(
      null,
      "",
      "/writing/short-answer-writing-51?problem=problem-1",
    );

    rerender(<GuardHarness when={false} />);
    expect(back).toHaveBeenCalledTimes(1);

    window.history.replaceState(
      null,
      "",
      "/writing/short-answer-writing-51?problem=problem-1&fresh=1",
    );
    fireEvent.popState(window);

    expect(replaceMock).toHaveBeenCalledWith(
      "/writing/short-answer-writing-51?problem=problem-1",
      { scroll: false },
    );
  });
});
