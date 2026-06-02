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

const updateUserMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      updateUser: (...args: unknown[]) => updateUserMock(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

import { PasswordResetConfirmForm } from "../../../src/components/auth/PasswordResetConfirmForm";

// PasswordResetConfirmForm now uses next-intl's useTranslations / useLocale —
// render inside the shared intl + antd App wrapper (baseline ko catalog,
// matching the Korean assertions below; locale=ko also drives formatAbsolute).
const renderInApp = renderWithIntl;

beforeEach(() => {
  updateUserMock.mockReset();
  updateUserMock.mockResolvedValue({ error: null });
  pushMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PasswordResetConfirmForm", () => {
  it("rejects mismatched password confirmation", async () => {
    renderInApp(<PasswordResetConfirmForm />);

    fireEvent.change(screen.getByLabelText("새 비밀번호"), {
      target: { value: "newpass12" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "DIFFERENT" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "비밀번호 변경" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("비밀번호가 일치하지 않습니다")).toBeTruthy();
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("calls updateUser with new password on valid submit and redirects", async () => {
    renderInApp(<PasswordResetConfirmForm />);

    fireEvent.change(screen.getByLabelText("새 비밀번호"), {
      target: { value: "newpass12" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "newpass12" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "비밀번호 변경" }),
      );
    });

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ password: "newpass12" });
    });
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
