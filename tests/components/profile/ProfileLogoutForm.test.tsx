// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const clearClientRecoveryForLogout = vi.hoisted(() => vi.fn());

vi.mock("@/lib/writing/client-recovery-cleanup", () => ({
  clearClientRecoveryForLogout,
}));

import { ProfileLogoutForm } from "../../../src/components/profile/ProfileLogoutForm";

afterEach(() => {
  cleanup();
});

describe("ProfileLogoutForm", () => {
  it("posts sign-out from the profile page footer", () => {
    const { container } = render(
      <ProfileLogoutForm label="로그아웃" userId="user-1" />,
    );

    const form = container.querySelector("form.app-profile-logout");
    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/auth/sign-out");
    expect(screen.getByTestId("profile-logout")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "로그아웃" }).getAttribute("type"),
    ).toBe("submit");
  });

  it("clears eligible local recovery data before posting sign-out", async () => {
    clearClientRecoveryForLogout.mockResolvedValueOnce(true);
    const { container } = render(
      <ProfileLogoutForm label="로그아웃" userId="user-1" />,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const nativeSubmit = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);

    fireEvent.submit(form);

    await waitFor(() =>
      expect(clearClientRecoveryForLogout).toHaveBeenCalledWith("user-1"),
    );
    expect(nativeSubmit).toHaveBeenCalledOnce();
    nativeSubmit.mockRestore();
  });
});
