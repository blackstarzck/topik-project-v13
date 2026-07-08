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

const getUserIdentitiesMock = vi.fn();
const linkIdentityMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUserIdentities: (...args: unknown[]) => getUserIdentitiesMock(...args),
      linkIdentity: (...args: unknown[]) => linkIdentityMock(...args),
    },
  }),
}));

import { AccountLoginMethodsCard } from "../../../src/components/profile/AccountLoginMethodsCard";

const labels = {
  regionAriaLabel: "Login methods",
  title: "Login methods",
  description: "Manage login methods.",
  emailMethod: "Email login",
  emailUnavailable: "Email unavailable",
  googleMethod: "Google login",
  googleDescription: "Use Google to sign in.",
  connected: "Connected",
  disconnected: "Not connected",
  connectGoogle: "Connect Google",
  connectFailed: "Could not start Google linking.",
  linkStarted: "Google linking started.",
};

function renderCard() {
  return renderWithIntl(
    <AccountLoginMethodsCard
      accountEmail="learner@example.com"
      labels={labels}
    />,
  );
}

describe("AccountLoginMethodsCard", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "http://localhost:3000/settings/account");
    getUserIdentitiesMock.mockReset();
    getUserIdentitiesMock.mockResolvedValue({
      data: {
        identities: [{ provider: "email" }],
      },
      error: null,
    });
    linkIdentityMock.mockReset();
    linkIdentityMock.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows email and disconnected Google login methods", async () => {
    renderCard();

    // 재설계: 섹션 타이틀/설명은 제거되고 카드만 남는다(이메일 주소·메서드 라벨로 검증).
    expect(screen.getByText("Email login")).toBeTruthy();
    expect(screen.getByText("learner@example.com")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Not connected")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Connect Google" })).toBeTruthy();
  });

  it("shows Google as connected when the identity exists", async () => {
    getUserIdentitiesMock.mockResolvedValueOnce({
      data: {
        identities: [{ provider: "email" }, { provider: "google" }],
      },
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("button", { name: "Connect Google" })).toBeNull();
  });

  it("starts Google identity linking from the authenticated profile screen", async () => {
    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect Google" }),
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
    });

    await waitFor(() => {
      expect(linkIdentityMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlink-google",
        },
      });
      expect(
        screen.queryByRole("button", { name: "Connect Google" }),
      ).toBeNull();
    });
  });

  it("does not expose raw provider errors when linking fails", async () => {
    linkIdentityMock.mockResolvedValue({
      data: null,
      error: { message: "provider token leaked raw detail" },
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect Google" }),
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));
    });

    await waitFor(() => {
      expect(linkIdentityMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "http://localhost:3000/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlink-google",
        },
      });
      expect(screen.getByText("Could not start Google linking.")).toBeTruthy();
    });
    expect(screen.queryByText(/provider token leaked raw detail/)).toBeNull();
  });
});
