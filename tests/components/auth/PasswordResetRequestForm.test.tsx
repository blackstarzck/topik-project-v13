// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const resetPasswordForEmailMock = vi.fn();
const getUserMock = vi.fn();
const buildAuthRedirectUrlMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmailMock(...args),
    },
  }),
}));

// D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재 시 동기
// throw — throw 경로를 단위에서 재현하기 위해 모듈을 mock으로 대체한다. 기본
// 구현은 실제 빌더와 같은 절대 URL을 돌려줘 기존 어서션을 그대로 유지한다.
vi.mock("@/lib/auth/redirect-url", () => ({
  buildAuthRedirectUrl: (path: string) => buildAuthRedirectUrlMock(path),
}));

import { PasswordResetRequestForm } from "../../../src/components/auth/PasswordResetRequestForm";

// PasswordResetRequestForm now uses next-intl's useTranslations — render inside
// the shared intl + antd App wrapper (baseline ko catalog, matching the
// Korean assertions below).
const renderInApp = renderWithIntl;

beforeEach(() => {
  resetPasswordForEmailMock.mockReset();
  resetPasswordForEmailMock.mockResolvedValue({ error: null });
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: null }, error: null });
  // The form's 60s send-cooldown persists to localStorage (keyed by
  // talkpik:password-reset:cooldown-until). Without clearing it, the cooldown
  // started by the first test leaks into the next test, leaving the submit
  // button disabled so handleSubmit early-returns and the success state never
  // renders. Clear it for a clean per-test cooldown state.
  window.localStorage.clear();
  buildAuthRedirectUrlMock.mockReset();
  buildAuthRedirectUrlMock.mockImplementation(
    (path: string) => `https://talkpik.example.com${path}`,
  );
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("PasswordResetRequestForm", () => {
  it("prefills the email field from the provided initial email", () => {
    renderInApp(<PasswordResetRequestForm initialEmail="member@example.com" />);

    expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe(
      "member@example.com",
    );
  });

  it("prefills the email field from the current auth user when available", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { email: "session.member@example.com" } },
      error: null,
    });
    renderInApp(<PasswordResetRequestForm />);

    await waitFor(() => {
      expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe(
        "session.member@example.com",
      );
    });
  });

  it("calls resetPasswordForEmail with redirect URL on submit", async () => {
    renderInApp(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "재설정 링크 보내기" }),
      );
    });

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
        "u@example.com",
        { redirectTo: "https://talkpik.example.com/password-reset/confirm" },
      );
    });
  });

  it("shows confirmation message after successful send", async () => {
    renderInApp(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "재설정 링크 보내기" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("이메일을 확인하세요")).toBeTruthy();
    });
  });

  it("shows the same confirmation message for unknown accounts", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({
      error: { code: "user_not_found" },
    });
    renderInApp(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "missing@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "재설정 링크 보내기" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("이메일을 확인하세요")).toBeTruthy();
    });
    expect(screen.getByText("missing@example.com")).toBeTruthy();
  });

  it("clears loading and shows an error when the redirect URL builder throws (D-2)", async () => {
    buildAuthRedirectUrlMock.mockImplementation(() => {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in non-development environments",
      );
    });
    renderInApp(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "재설정 링크 보내기" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/전송 실패/)).toBeTruthy();
    });
    // throw는 URL 빌드 단계에서 발생 — supabase 호출/성공 화면 전환이 없어야 한다.
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("password-reset-sent-state")).toBeNull();
    // 버튼 영구 로딩(D-2) 회귀 방지: finally가 submitting을 해제해야 한다.
    const button = screen.getByRole("button", { name: "재설정 링크 보내기" });
    expect(button.className).not.toContain("ant-btn-loading");
  });
});
