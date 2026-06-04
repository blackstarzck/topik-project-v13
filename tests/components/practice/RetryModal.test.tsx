// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
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
    renderWithIntl(
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
    // C-03 upgrade: primary CTA label is now '시작' (was '다시 풀기').
    expect(screen.getByRole("button", { name: "시작" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "결과 보기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("'시작' in fresh mode pushes the Wireframe-slug writing route with problem and fresh params", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <RetryModal
        open
        onClose={onClose}
        problemId="p-1"
        questionNo={53}
        hasAttempt
        hasSubmission={false}
      />,
    );
    // C-03 adds a 재풀이 모드 Radio.Group; default for hasAttempt is 'resume'.
    // Select '새 답안으로 시작' (fresh) so the route carries &fresh=1.
    fireEvent.click(screen.getByRole("radio", { name: /새 답안으로 시작/ }));
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    // handleStart no longer calls onClose; the route push drives the transition.
    expect(pushMock).toHaveBeenCalledWith(
      "/writing/long-form-writing-53?problem=p-1&fresh=1",
    );
  });

  it("'시작' with null questionNo shows a recoverable start-failure alert (keeps modal open, no push)", () => {
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={null}
        hasAttempt
        hasSubmission={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    // C-03: null questionNo is now a recoverable start failure — inline error
    // Alert + modal stays open, instead of silently pushing to /practice/problems.
    expect(
      screen.getByText(
        "문제 유형 정보를 찾을 수 없어 시작할 수 없어요. 잠시 후 다시 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("'결과 보기' routes short feedback for question_no 51/52", () => {
    renderWithIntl(
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
    renderWithIntl(
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
    renderWithIntl(
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
    renderWithIntl(
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
