// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionAndProfileMock = vi.fn();
const getAuthCompletionStatusForSessionMock = vi.fn();
const workspaceShellMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/components/app/WorkspaceShell", () => ({
  WorkspaceShell: (props: { children: ReactNode }) => {
    workspaceShellMock(props);
    return <main data-testid="workspace-shell">{props.children}</main>;
  },
}));

vi.mock("@/lib/auth/profile", () => ({
  getSessionAndProfile: () => getSessionAndProfileMock(),
  isActiveStatus: (status: string | null | undefined) => status === "active",
}));

vi.mock("@/lib/auth/completion", () => ({
  getAuthCompletionStatusForSession: (...args: unknown[]) =>
    getAuthCompletionStatusForSessionMock(...args),
}));

import WorkspaceLayout from "../../src/app/(workspace)/layout";

const session = {
  user: {
    id: "user-1",
    email: "student@example.com",
    email_confirmed_at: "2026-06-29T00:00:00.000Z",
  },
  profile: {
    app_role: "student",
    display_name: "Chan",
    nationality_country_code: "KR",
    nickname: "talkpik-abc123",
    avatar_path: "user-1/avatar.png",
    plan_label: "Free",
    status: "active",
  },
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
    workspaceShellMock.mockClear();
    getSessionAndProfileMock.mockReset();
    getAuthCompletionStatusForSessionMock.mockReset();
    getAuthCompletionStatusForSessionMock.mockResolvedValue("ready");
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects anonymous users to login", async () => {
    getSessionAndProfileMock.mockResolvedValue(null);

    await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(getAuthCompletionStatusForSessionMock).not.toHaveBeenCalled();
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
    expect(getAuthCompletionStatusForSessionMock).not.toHaveBeenCalled();
  });

  it("redirects blocked accounts to the account-inactive clear route", async () => {
    getSessionAndProfileMock.mockResolvedValue({
      ...session,
      profile: { ...session.profile, status: "blocked" },
    });

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/account-inactive?status=blocked",
    );

    expect(getAuthCompletionStatusForSessionMock).not.toHaveBeenCalled();
  });

  it("redirects active email-unverified users before rendering workspace shell", async () => {
    getSessionAndProfileMock.mockResolvedValue({
      ...session,
      user: { ...session.user, email_confirmed_at: null },
    });

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/verify-email?email=student%40example.com",
    );

    expect(getAuthCompletionStatusForSessionMock).not.toHaveBeenCalled();
    expect(workspaceShellMock).not.toHaveBeenCalled();
  });

  it("redirects users with incomplete auth completion back into post-auth", async () => {
    getSessionAndProfileMock.mockResolvedValue(session);
    getAuthCompletionStatusForSessionMock.mockResolvedValueOnce(
      "pending-auth-completion",
    );

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/post-auth?intent=login",
    );

    expect(getAuthCompletionStatusForSessionMock).toHaveBeenCalledWith(session);
  });

  it("redirects users with missing required consent before rendering workspace shell", async () => {
    getSessionAndProfileMock.mockResolvedValue(session);
    getAuthCompletionStatusForSessionMock.mockResolvedValueOnce(
      "pending-consent",
    );

    await expect(renderLayout()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/post-auth?intent=login",
    );

    expect(getAuthCompletionStatusForSessionMock).toHaveBeenCalledWith(session);
    expect(workspaceShellMock).not.toHaveBeenCalled();
  });

  it("renders workspace content after consent is complete", async () => {
    getSessionAndProfileMock.mockResolvedValue(session);

    await renderLayout();

    expect(screen.getByTestId("workspace-shell")).toBeTruthy();
    expect(screen.getByText("private area")).toBeTruthy();
  });

  it("passes profile identity data to the workspace shell", async () => {
    getSessionAndProfileMock.mockResolvedValue(session);

    await renderLayout();

    expect(workspaceShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "student@example.com",
        displayName: "Chan",
        nickname: "talkpik-abc123",
        avatarPath: "user-1/avatar.png",
      }),
    );
  });
});
