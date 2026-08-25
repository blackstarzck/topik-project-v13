// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";

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
const resetPasswordForEmailMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUserIdentities: (...args: unknown[]) => getUserIdentitiesMock(...args),
      linkIdentity: (...args: unknown[]) => linkIdentityMock(...args),
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmailMock(...args),
    },
  }),
}));

import { AccountLoginMethodsCard } from "../../../src/components/profile/AccountLoginMethodsCard";
import { GoogleMark } from "../../../src/components/auth/GoogleMark";

const accountLoginMethodsSource = readFileSync(
  path.join(
    process.cwd(),
    "src",
    "components",
    "profile",
    "AccountLoginMethodsCard.tsx",
  ),
  "utf8",
);

const labels = {
  regionAriaLabel: "Login methods",
  title: "Login methods",
  description: "Manage login methods.",
  emailMethod: "Email login",
  emailUnavailable: "Email unavailable",
  googleMethod: "Google login",
  googleDescription: "Use Google to sign in.",
  passwordMethod: "Change password",
  passwordDescription:
    "Send an email link to change the password for this account.",
  passwordAction: "Send link",
  passwordSent: "Password change link sent.",
  passwordRateLimited: "Please wait before sending another password email.",
  passwordSendFailed: "Could not send the password change link.",
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
    resetPasswordForEmailMock.mockReset();
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("keeps the shared Google mark default at 18 pixels", () => {
    const { container } = renderWithIntl(<GoogleMark />);
    const googleMark = container.querySelector("svg");

    expect(googleMark?.getAttribute("width")).toBe("18");
    expect(googleMark?.getAttribute("height")).toBe("18");
    expect(googleMark?.getAttribute("aria-hidden")).toBe("true");
    expect(googleMark?.getAttribute("focusable")).toBe("false");
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

  it("reuses the decorative Google mark at the account-card size", () => {
    renderCard();

    const googleCard = screen
      .getByText("Google login")
      .closest(".account-login-method");
    const googleMark = googleCard?.querySelector("svg");

    expect(accountLoginMethodsSource).toContain(
      'import { GoogleMark } from "@/components/auth/GoogleMark";',
    );
    expect(accountLoginMethodsSource).not.toContain("function GoogleGlyph");
    expect(accountLoginMethodsSource).not.toMatch(
      /fill=["']#[0-9a-f]{6}["']/iu,
    );
    expect(googleMark?.getAttribute("aria-hidden")).toBe("true");
    expect(googleMark?.getAttribute("focusable")).toBe("false");
    expect(googleMark?.getAttribute("width")).toBe("20");
    expect(googleMark?.getAttribute("height")).toBe("20");
    expect(googleMark?.getAttribute("viewBox")).toBe("0 0 18 18");
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
    expect(screen.getByRole("button", { name: "Send link" })).toBeTruthy();
  });

  it("renders the password change card between email and Google methods", () => {
    renderCard();

    const emailTitle = screen.getByText("Email login");
    const passwordTitle = screen.getByText("Change password");
    const googleTitle = screen.getByText("Google login");

    expect(
      emailTitle.compareDocumentPosition(passwordTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      passwordTitle.compareDocumentPosition(googleTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Change password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send link" })).toBeTruthy();
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

  it("sends a password setup link as a message and shows the cooldown on the button", async () => {
    renderCard();

    const sendButton = await screen.findByRole("button", {
      name: "Send link",
    });

    await act(async () => {
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
        "learner@example.com",
        {
          redirectTo:
            "http://localhost:3000/auth/callback?next=%2Fpassword-reset%2Fconfirm",
        },
      );
      expect(screen.getByText("Password change link sent.")).toBeTruthy();
      expect(document.querySelector(".ant-alert-success")).toBeNull();
      expect(
        screen.getByRole("button", { name: /Send link \(\d+\)/ }),
      ).toBeTruthy();
    });
  });

  it("shows a rate-limit message when password setup email is throttled", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({
      error: {
        code: "over_email_send_rate_limit",
        status: 429,
        message: "provider raw rate limit detail",
      },
    });

    renderCard();

    const sendButton = await screen.findByRole("button", {
      name: "Send link",
    });

    await act(async () => {
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Please wait before sending another password email."),
      ).toBeTruthy();
    });
    expect(document.querySelector(".ant-alert-error")).toBeNull();
    expect(screen.queryByText(/provider raw rate limit detail/)).toBeNull();
  });

  it("does not expose raw provider errors when password setup email fails", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({
      error: {
        code: "unexpected_failure",
        message: "provider raw password reset failure",
      },
    });

    renderCard();

    const sendButton = await screen.findByRole("button", {
      name: "Send link",
    });

    await act(async () => {
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Could not send the password change link."),
      ).toBeTruthy();
    });
    expect(document.querySelector(".ant-alert-error")).toBeNull();
    expect(
      screen.queryByText(/provider raw password reset failure/),
    ).toBeNull();
  });
});
