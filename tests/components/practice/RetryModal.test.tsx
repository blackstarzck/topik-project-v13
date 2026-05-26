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

describe("RetryModal (Phase 7-D Task 5 route fix)", () => {
  it("renders three buttons when both attempt and submission exist", () => {
    render(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={51}
        hasAttempt
        hasSubmission
        submissionId="sub-9"
      />,
    );

    expect(screen.getByText("이전 풀이가 있어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 풀기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "결과 보기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("'다시 풀기' pushes /writing/[questionNo]?problem=...&fresh=1", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open
        onClose={onClose}
        problemId="p-1"
        questionNo={53}
        hasAttempt
        hasSubmission={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }));
    expect(onClose).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/writing/53?problem=p-1&fresh=1");
  });

  it("'다시 풀기' with null questionNo falls back to /practice/problems", () => {
    render(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={null}
        hasAttempt
        hasSubmission={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }));
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("'결과 보기' routes short feedback for question_no 51/52", () => {
    render(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={52}
        hasAttempt
        hasSubmission
        submissionId="sub-9"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(pushMock).toHaveBeenCalledWith("/writing/feedback/short/sub-9");
  });

  it("'결과 보기' routes long feedback for question_no 53/54", () => {
    render(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={54}
        hasAttempt
        hasSubmission
        submissionId="sub-9"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(pushMock).toHaveBeenCalledWith("/writing/feedback/long/sub-9");
  });

  it("'결과 보기' falls back to /practice/problems when submissionId missing", () => {
    render(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-2"
        questionNo={51}
        hasAttempt
        hasSubmission
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("'취소' closes without navigation", () => {
    const onClose = vi.fn();
    render(
      <RetryModal
        open
        onClose={onClose}
        problemId="p-1"
        questionNo={51}
        hasAttempt
        hasSubmission
        submissionId="sub-9"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
