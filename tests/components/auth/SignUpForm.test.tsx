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

const signUpMock = vi.fn();
const resendMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const pushMock = vi.fn();
const buildAuthRedirectUrlMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      resend: (...args: unknown[]) => resendMock(...args),
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
}));

import { SignUpForm } from "../../../src/components/auth/SignUpForm";

// SignUpForm now uses next-intl's useTranslations — render inside the shared
// intl + antd App wrapper (baseline ko catalog, matching the assertions).
const renderInApp = renderWithIntl;

function fillValidSignUpForm(email = "valid@example.com") {
  fireEvent.change(document.querySelector("#displayName")!, {
    target: { value: "Tester" },
  });
  fireEvent.change(document.querySelector("#email")!, {
    target: { value: email },
  });
  fireEvent.change(document.querySelector("#password")!, {
    target: { value: "password123" },
  });
  fireEvent.change(document.querySelector("#passwordConfirm")!, {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

function submitButton() {
  return document.querySelector('button[type="submit"]') as HTMLButtonElement;
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "http://localhost:3000/sign-up");
  setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  );
  window.localStorage.clear();
  signUpMock.mockReset();
  signUpMock.mockResolvedValue({ error: null });
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
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

describe("SignUpForm", () => {
  it("requires terms acceptance before submit", async () => {
    renderInApp(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "password123" },
    });
    // terms NOT checked

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(screen.getByText("이용약관에 동의해주세요")).toBeTruthy();
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched password confirmation", async () => {
    renderInApp(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "u@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "DIFFERENT" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(screen.getByText("비밀번호가 일치하지 않습니다")).toBeTruthy();
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("calls supabase.auth.signUp with emailRedirectTo on valid submit", async () => {
    renderInApp(<SignUpForm />);

    // A-01 reordered fields to 이름→이메일→비밀번호→비밀번호 확인 and made
    // 이름(displayName) a required field, so it must be filled for the form to
    // pass validation and call signUp.
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "valid@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1);
    });
    const call = signUpMock.mock.calls[0][0];
    expect(call.email).toBe("valid@example.com");
    expect(call.password).toBe("password123");
    // Phase 8-D: emailRedirectTo now points to /auth/callback?next=...
    expect(call.options.emailRedirectTo).toBe(
      "https://talkpik.example.com/auth/callback?next=/onboarding/learning-goal",
    );
  });

  it("redirects to /auth/verify-email after successful sign-up (Phase 8-D)", async () => {
    renderInApp(<SignUpForm />);

    // A-01: 이름(displayName) is required — fill it so submit succeeds.
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "valid@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock.mock.calls[0][0]).toBe(
      "/auth/verify-email?email=valid%40example.com",
    );
  });

  it("redirects to /auth/verify-email for a no-user success-like signup response", async () => {
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    });
    renderInApp(<SignUpForm />);

    fillValidSignUpForm("obfuscated@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock.mock.calls[0][0]).toBe(
      "/auth/verify-email?email=obfuscated%40example.com",
    );
  });

  it("shows safe account guidance for explicit duplicate signup errors", async () => {
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: "user_already_exists",
        message: "User already registered",
        status: 422,
      },
    });
    renderInApp(<SignUpForm />);

    fillValidSignUpForm("registered@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-safe-guidance")).toBeTruthy();
    });
    expect(
      screen.getByText(
        "이 이메일로 바로 새 가입을 계속할 수 없어요. 이미 계정을 만든 적이 있다면 로그인하거나 비밀번호를 재설정해 주세요.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("User already registered")).toBeNull();
    expect(screen.queryByText(/이미 가입된 이메일/)).toBeNull();
    expect(screen.queryByText(/계정이 존재/)).toBeNull();
    expect(
      screen.getByTestId("sign-up-safe-guidance-login").getAttribute("href"),
    ).toBe("/login");
    expect(
      screen.getByTestId("sign-up-safe-guidance-reset").getAttribute("href"),
    ).toBe("/password-reset");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("starts a signup cooldown for rate-limited signup responses", async () => {
    const onCooldownChange = vi.fn();
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
        status: 429,
      },
    });
    renderInApp(<SignUpForm onCooldownChange={onCooldownChange} />);

    fillValidSignUpForm("limited@example.com");

    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-countdown")).toBeTruthy();
    });
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain("회원가입");
    expect(onCooldownChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      fireEvent.click(submitButton());
    });
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("restores the signup cooldown from localStorage after a reload", async () => {
    const onCooldownChange = vi.fn();
    window.localStorage.setItem(
      "talkpik:sign-up:cooldown-until",
      String(Date.now() + 43_000),
    );

    renderInApp(<SignUpForm onCooldownChange={onCooldownChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("sign-up-countdown")).toBeTruthy();
    });
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain("회원가입");
    expect(onCooldownChange).toHaveBeenLastCalledWith(true);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("clears loading and shows an error when the redirect URL builder throws (D-2)", async () => {
    buildAuthRedirectUrlMock.mockImplementation(() => {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in non-development environments",
      );
    });
    renderInApp(<SignUpForm />);

    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "valid@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    });

    await waitFor(() => {
      expect(screen.getByText(/가입 실패/)).toBeTruthy();
    });
    // throw는 URL 빌드 단계에서 발생 — supabase 호출/리다이렉트가 없어야 한다.
    expect(signUpMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    // 버튼 영구 로딩(D-2) 회귀 방지: finally가 submitting을 해제해야 한다.
    const button = screen.getByRole("button", { name: "회원가입" });
    expect(button.className).not.toContain("ant-btn-loading");
  });

  it("starts Google OAuth without requiring the email sign-up form", async () => {
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOAuthMock.mock.calls[0][0]).toEqual({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
      },
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows external-browser guidance instead of starting Google OAuth in KakaoTalk", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.7.0",
    );
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("oauth-browser-warning")).toBeTruthy();
    });
    expect(
      screen.getByText("카카오톡 안에서는 Google 로그인이 막힐 수 있어요"),
    ).toBeTruthy();
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows an AntD message when Google OAuth cannot start", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { url: "" },
      error: { code: "unknown", message: "OAuth failed" },
    });
    renderInApp(<SignUpForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Google로 계속" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Google 인증을 시작하지 못했어요. 잠시 후 다시 시도해주세요.",
        ),
      ).toBeTruthy();
    });
  });
});
