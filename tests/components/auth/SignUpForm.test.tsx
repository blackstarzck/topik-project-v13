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
const pushMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      resend: (...args: unknown[]) => resendMock(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

import { SignUpForm } from "../../../src/components/auth/SignUpForm";

// SignUpForm now uses next-intl's useTranslations — render inside the shared
// intl + antd App wrapper (baseline ko catalog, matching the assertions).
const renderInApp = renderWithIntl;

beforeEach(() => {
  signUpMock.mockReset();
  signUpMock.mockResolvedValue({ error: null });
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
  pushMock.mockReset();

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
});
