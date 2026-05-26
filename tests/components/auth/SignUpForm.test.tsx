// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App as AntdApp } from "antd";
import type { ReactNode } from "react";

const signUpMock = vi.fn();
const resendMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      resend: (...args: unknown[]) => resendMock(...args),
    },
  }),
}));

import { SignUpForm } from "../../../src/components/auth/SignUpForm";

function renderInApp(node: ReactNode) {
  return render(<AntdApp>{node}</AntdApp>);
}

beforeEach(() => {
  signUpMock.mockReset();
  signUpMock.mockResolvedValue({ error: null });
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });

  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");

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
    expect(call.options.emailRedirectTo).toBe(
      "https://talkpik.example.com/onboarding/learning-goal",
    );
  });

  it("shows email confirmation screen after successful sign-up", async () => {
    renderInApp(<SignUpForm />);

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
      expect(screen.getByText("이메일을 확인하세요")).toBeTruthy();
    });
    expect(
      screen.getByRole("button", { name: "이메일 다시 보내기" }),
    ).toBeTruthy();
  });

  it("calls supabase.auth.resend when 'resend' button clicked", async () => {
    renderInApp(<SignUpForm />);

    // submit first
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
    await waitFor(() =>
      screen.getByRole("button", { name: "이메일 다시 보내기" }),
    );

    // click resend
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "이메일 다시 보내기" }),
      );
    });

    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledTimes(1);
    });
    const resendCall = resendMock.mock.calls[0][0];
    expect(resendCall.type).toBe("signup");
    expect(resendCall.email).toBe("valid@example.com");
  });
});
