// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProfileLogoutForm } from "../../../src/components/profile/ProfileLogoutForm";

afterEach(() => {
  cleanup();
});

describe("ProfileLogoutForm", () => {
  it("posts sign-out from the profile page footer", () => {
    const { container } = render(<ProfileLogoutForm label="로그아웃" />);

    const form = container.querySelector("form.app-profile-logout");
    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe("/auth/sign-out");
    expect(screen.getByTestId("profile-logout")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "로그아웃" }).getAttribute("type"),
    ).toBe("submit");
  });
});
