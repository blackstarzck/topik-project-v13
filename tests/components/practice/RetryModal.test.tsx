// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RetryModal } from "../../../src/components/practice/RetryModal";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

beforeEach(() => {
  pushMock.mockReset();
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
});

describe("RetryModal", () => {
  it("renders three buttons when both attempt and submission exist", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open={true}
        onClose={onClose}
        problemId="p-1"
        hasAttempt={true}
        hasSubmission={true}
        submissionId="sub-9"
      />,
    );

    expect(screen.getByText("이전 풀이가 있어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 풀기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "결과 보기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("'다시 풀기' closes modal and pushes ?fresh=1 route", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open={true}
        onClose={onClose}
        problemId="p-1"
        hasAttempt={true}
        hasSubmission={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/p-1?fresh=1");
  });

  it("'결과 보기' routes to /feedback/[submissionId] when hasSubmission + submissionId", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open={true}
        onClose={onClose}
        problemId="p-1"
        hasAttempt={true}
        hasSubmission={true}
        submissionId="sub-9"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/feedback/sub-9");
  });

  it("'결과 보기' routes to problem result when hasAttempt only (no submission)", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open={true}
        onClose={onClose}
        problemId="p-2"
        hasAttempt={true}
        hasSubmission={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/p-2/result");
  });

  it("'결과 보기' falls back to problem result when hasSubmission but submissionId missing", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open={true}
        onClose={onClose}
        problemId="p-3"
        hasAttempt={true}
        hasSubmission={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/p-3/result");
  });

  it("'취소' closes modal without navigation", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open={true}
        onClose={onClose}
        problemId="p-1"
        hasAttempt={true}
        hasSubmission={true}
        submissionId="sub-9"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
