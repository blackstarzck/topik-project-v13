// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { RetryModal } from "../../../src/components/practice/RetryModal";
import koMessages from "../../../messages/ko.json";

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
  it("keeps footer CTAs to start/cancel while exposing result view as contextual action", () => {
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
    expect(screen.getByRole("button", { name: "결과 보기" })).toBeTruthy();

    const footerActions = within(screen.getByTestId("retry-modal-actions"));
    // C-03 §4 keeps the bottom action pair fixed to start/cancel.
    expect(footerActions.getAllByRole("button")).toHaveLength(2);
    expect(
      screen
        .getByTestId("retry-modal-actions")
        .classList.contains("app-modal-footer-actions"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "시작" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("does not wrap mode choices in bordered card containers", () => {
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        problemTitle="알고리즘 추천 서비스"
        questionNo={54}
        attemptCount={1}
        hasAttempt
        hasSubmission={false}
      />,
    );

    expect(screen.getByText("알고리즘 추천 서비스")).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: /새 답안으로 시작/ }),
    ).toBeTruthy();
    expect(document.querySelector(".app-modal .border-border")).toBeNull();
  });

  it("uses AntD bordered Descriptions for the top summary", () => {
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        problemTitle="알고리즘 추천 서비스"
        questionNo={54}
        attemptCount={1}
        lastAttemptAt={new Date().toISOString()}
        hasAttempt
        hasSubmission={false}
      />,
    );

    const summary = screen.getByTestId("retry-modal-compact-summary");
    expect(summary.classList.contains("ant-descriptions")).toBe(true);
    expect(summary.classList.contains("ant-descriptions-bordered")).toBe(true);
    expect(summary.textContent).toContain("알고리즘 추천 서비스");
    expect(summary.textContent).toContain("54번");
    expect(summary.textContent).toContain("작성 중(임시 저장)");
    expect(summary.textContent).toContain("시도 1회");
    expect(summary.textContent).toContain("오늘");
    expect(within(summary).getByText("문제")).toBeTruthy();
    expect(within(summary).getByText("유형")).toBeTruthy();
    expect(within(summary).getByText("이전 상태")).toBeTruthy();
  });

  it("'시작' in fresh mode pushes the question-specific writing route with problem and fresh params", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <RetryModal
        open
        onClose={onClose}
        problemId="p-1"
        questionNo={53}
        returnTo="/library/problems"
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
      "/writing/long-form-writing-53?problem=p-1&fresh=1&returnTo=%2Flibrary%2Fproblems",
    );
  });

  it("keeps hint mode disabled while hint retry is deferred", () => {
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={54}
        hasAttempt
        hasSubmission={false}
      />,
    );

    const hintMode = screen.getByRole("radio", { name: /힌트 포함/ });
    expect(hintMode.hasAttribute("disabled")).toBe(true);
    fireEvent.click(hintMode);
    fireEvent.click(screen.getByRole("button", { name: "시작" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/writing/essay-writing-54?problem=p-1",
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

  it("labels failed submissions and routes the failed status action", () => {
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
        feedbackStatus="failed"
      />,
    );

    expect(
      screen.getByTestId("retry-modal-compact-summary").textContent,
    ).toContain(koMessages.practice.retry.statusSubmittedRecentFailure);

    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.practice.retry.viewFailedStatus,
      }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/writing/feedback/short/sub-9");
  });

  it("labels a failed-only attempt as requiring resubmission", () => {
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={51}
        hasAttempt
        hasSubmission={false}
        submissionId="sub-failed"
        feedbackStatus="failed"
      />,
    );

    expect(
      screen.getByTestId("retry-modal-compact-summary").textContent,
    ).toContain(koMessages.practice.retry.statusFailed);
  });

  it("labels pending and analyzing attempts as analysis in progress", () => {
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={51}
        hasAttempt
        hasSubmission={false}
        submissionId="sub-pending"
        feedbackStatus="pending"
      />,
    );

    expect(
      screen.getByTestId("retry-modal-compact-summary").textContent,
    ).toContain(koMessages.practice.retry.statusAnalyzing);

    cleanup();
    renderWithIntl(
      <RetryModal
        open
        onClose={vi.fn()}
        problemId="p-1"
        questionNo={51}
        hasAttempt
        hasSubmission={false}
        submissionId="sub-analyzing"
        feedbackStatus="analyzing"
      />,
    );

    expect(
      screen.getByTestId("retry-modal-compact-summary").textContent,
    ).toContain(koMessages.practice.retry.statusAnalyzing);
  });
});
