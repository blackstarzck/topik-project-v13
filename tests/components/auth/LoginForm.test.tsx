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

const signInWithPasswordMock = vi.fn();
const signInWithOtpMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        signInWithPasswordMock(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

import { LoginForm } from "../../../src/components/auth/LoginForm";

function renderInApp(node: ReactNode) {
  return render(<AntdApp>{node}</AntdApp>);
}

beforeEach(() => {
  signInWithPasswordMock.mockReset();
  signInWithPasswordMock.mockResolvedValue({ error: null });
  signInWithOtpMock.mockReset();
  signInWithOtpMock.mockResolvedValue({ error: null });
  pushMock.mockReset();
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
    // Phase 8-D: magic-link redirect now flows through /auth/callback
    expect(call.options.emailRedirectTo).toBe(
      "https://talkpik.example.com/auth/callback?next=/dashboard",
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

  it("shows password-reset link in password mode", () => {
    renderInApp(<LoginForm />);
    const link = screen.getByText("비밀번호를 잊으셨나요?");
    expect(link).toBeTruthy();
    expect(link.closest("a")?.getAttribute("href")).toBe("/password-reset");
  });
});
