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

const resetPasswordForEmailMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmailMock(...args),
    },
  }),
}));

import { PasswordResetRequestForm } from "../../../src/components/auth/PasswordResetRequestForm";

function renderInApp(node: ReactNode) {
  return render(<AntdApp>{node}</AntdApp>);
}

beforeEach(() => {
  resetPasswordForEmailMock.mockReset();
  resetPasswordForEmailMock.mockResolvedValue({ error: null });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        media: "",
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

describe("PasswordResetRequestForm", () => {
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
});
