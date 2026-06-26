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

const signInWithPasswordMock = vi.fn();
const signInWithOtpMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const pushMock = vi.fn();
const buildAuthRedirectUrlMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        signInWithPasswordMock(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
    },
  }),
}));

// D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재 시 동기
// throw — throw 경로를 단위에서 재현하기 위해 모듈을 mock으로 대체한다. 기본
// 구현은 실제 빌더와 같은 절대 URL을 돌려줘 기존 어서션을 그대로 유지한다.
vi.mock("@/lib/auth/redirect-url", () => ({
  buildAuthRedirectUrl: (path: string) => buildAuthRedirectUrlMock(path),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

import { LoginForm } from "../../../src/components/auth/LoginForm";

// LoginForm now uses next-intl's useTranslations, so it must render inside a
// NextIntlClientProvider. renderWithIntl wraps the baseline (ko) catalog — the
// same Korean strings the assertions below match — plus antd's App.
const renderInApp = renderWithIntl;

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "http://localhost:3000/login");
  setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  );
  signInWithPasswordMock.mockReset();
  signInWithPasswordMock.mockResolvedValue({ error: null });
  signInWithOtpMock.mockReset();
  signInWithOtpMock.mockResolvedValue({ error: null });
  signInWithOAuthMock.mockReset();
  signInWithOAuthMock.mockResolvedValue({ data: { url: "" }, error: null });
  pushMock.mockReset();
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

describe("LoginForm", () => {
  it("submits password login and redirects to dashboard", async () => {
    renderInApp(<LoginForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "secret-pass" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    });

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret-pass",
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("switches to magic-link mode and sends OTP with redirect URL", async () => {
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByText("매직링크 로그인"));
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "로그인 링크 받기" }));
    });

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    });
    const call = signInWithOtpMock.mock.calls[0][0];
    expect(call.email).toBe("u@example.com");
    // Auth completion gate: magic-link success must re-enter post-auth.
    expect(call.options.emailRedirectTo).toBe(
      "https://talkpik.example.com/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin",
    );
  });

  it("shows confirmation screen after magic-link sent", async () => {
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByText("매직링크 로그인"));
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "로그인 링크 받기" }));
    });

    await waitFor(() => {
      expect(screen.getByText("이메일을 확인하세요")).toBeTruthy();
    });
  });

  it("clears loading and shows an error when the redirect URL builder throws (D-2)", async () => {
    buildAuthRedirectUrlMock.mockImplementation(() => {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in non-development environments",
      );
    });
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByText("매직링크 로그인"));
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "로그인 링크 받기" }));
    });

    await waitFor(() => {
      expect(screen.getByText(/매직링크 전송 실패/)).toBeTruthy();
    });
    // throw는 URL 빌드 단계에서 발생 — supabase 호출 자체가 없어야 한다.
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    // 버튼 영구 로딩(D-2) 회귀 방지: finally가 submitting을 해제해야 한다.
    const button = screen.getByRole("button", { name: "로그인 링크 받기" });
    expect(button.className).not.toContain("ant-btn-loading");
  });

  it("shows password-reset link in password mode", () => {
    renderInApp(<LoginForm />);
    const link = screen.getByText("비밀번호를 잊으셨나요?");
    expect(link).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toBe("/password-reset");
  });

  it("shows the remember-me affordance checked by default", () => {
    renderInApp(<LoginForm />);
    const checkbox = screen.getByLabelText(
      "로그인 상태 유지",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("starts Google OAuth with post-auth redirect", async () => {
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    });

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOAuthMock.mock.calls[0][0]).toEqual({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin",
      },
    });
  });

  it("shows external-browser guidance instead of starting Google OAuth in KakaoTalk", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.7.0",
    );
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("oauth-browser-warning")).toBeTruthy();
    });
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
  });

  it("does not render Kakao OAuth entry", () => {
    renderInApp(<LoginForm />);

    expect(screen.queryByRole("button", { name: /Kakao|카카오/ })).toBeNull();
  });

  it("shows external-browser guidance instead of starting Google OAuth in Line", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/14.0.0",
    );
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("oauth-browser-warning")).toBeTruthy();
    });
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
  });

  it("shows an error alert when Google OAuth cannot start", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { url: "" },
      error: { code: "unknown", message: "OAuth failed" },
    });
    renderInApp(<LoginForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 로그인" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "잠시 후 다시 시도해주세요. 문제가 계속되면 잠시 뒤 다시 시도해주세요.",
        ),
      ).toBeTruthy();
    });
  });
});
