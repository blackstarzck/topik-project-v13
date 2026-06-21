// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionAndProfileMock = vi.fn();
const hasCompletedRequiredConsentMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/components/app/WorkspaceShell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => (
    <main data-testid="workspace-shell">{children}</main>
  ),
}));

vi.mock("@/lib/auth/profile", () => ({
  getSessionAndProfile: () => getSessionAndProfileMock(),
  isActiveStatus: (status: string | null | undefined) => status === "active",
}));

vi.mock("@/lib/auth/completion", () => ({
  hasCompletedRequiredConsent: (...args: unknown[]) =>
    hasCompletedRequiredConsentMock(...args),
}));

import WorkspaceLayout from "../../src/app/(workspace)/layout";

const session = {
  user: { id: "user-1", email: "student@example.com" },
  profile: { app_role: "student", plan_label: "Free", status: "active" },
};

async function renderLayout() {
  const element = await WorkspaceLayout({
    children: <span>private area</span>,
  });
  render(element);
}

describe("(workspace) layout auth completion guard", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getSessionAndProfileMock.mockReset();
    hasCompletedRequiredConsentMock.mockReset();
    hasCompletedRequiredConsentMock.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects anonymous users to login", async () => {
    getSessionAndProfileMock.mockResolvedValue(null);

    await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(hasCompletedRequiredConsentMock).not.toHaveBeenCalled();
  });

  it("redirects withdrawn (deleted) accounts to the account-inactive clear route", async () => {
    getSessionAndProfileMock.mockResolvedValue({
      ...session,
      profile: { ...session.profile, status: "deleted" },
    });

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/account-inactive?status=deleted",
    );

    // status 게이트는 consent 검사보다 먼저 차단해야 한다.
    expect(hasCompletedRequiredConsentMock).not.toHaveBeenCalled();
  });

  it("redirects blocked accounts to the account-inactive clear route", async () => {
    getSessionAndProfileMock.mockResolvedValue({
      ...session,
      profile: { ...session.profile, status: "blocked" },
    });

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/account-inactive?status=blocked",
    );

    expect(hasCompletedRequiredConsentMock).not.toHaveBeenCalled();
  });

  it("redirects users with missing consent back into post-auth", async () => {
    getSessionAndProfileMock.mockResolvedValue(session);
    hasCompletedRequiredConsentMock.mockResolvedValueOnce(false);

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/post-auth?intent=login",
    );

    expect(hasCompletedRequiredConsentMock).toHaveBeenCalledWith(session);
  });

  it("renders workspace content after consent is complete", async () => {
    getSessionAndProfileMock.mockResolvedValue(session);

    await renderLayout();

    expect(screen.getByTestId("workspace-shell")).toBeTruthy();
    expect(screen.getByText("private area")).toBeTruthy();
  });
});
