// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const getUserMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerPushMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({ get: () => null }),
}));

import { AuthPromptExperience } from "../../../src/components/auth/AuthPromptExperience";

function renderLoginPrompt() {
  return renderWithIntl(
    <AuthPromptExperience
      mode="login"
      pageHeading="Login"
      formSubtitle="Continue with your account"
      heroEyebrow="Login hero"
      mascotAlt="Login mascot"
      switchPrompt="No account?"
      switchHref="/sign-up"
      switchLabel="Sign up"
    />,
  );
}

function renderSignUpPrompt() {
  return renderWithIntl(
    <AuthPromptExperience
      mode="sign-up"
      pageHeading="Sign up"
      formSubtitle="Create your account"
      heroEyebrow="Sign-up hero"
      mascotAlt="Sign-up mascot"
      switchPrompt="Already have an account?"
      switchHref="/login"
      switchLabel="Log in"
    />,
  );
}

function persistedPageShowEvent() {
  const event = new Event("pageshow") as PageTransitionEvent;
  Object.defineProperty(event, "persisted", { value: true });
  return event;
}

describe("AuthPromptExperience", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "http://localhost:3000/login");
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("replaces authenticated login entry pages with post-auth on mount", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });

    renderLoginPrompt();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=login",
      );
    });
  });

  it("keeps the sign-up intent when replacing an authenticated sign-up page", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });

    renderSignUpPrompt();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=sign-up",
      );
    });
  });

  it("rechecks persisted pageshow restores after OAuth browser-back navigation", async () => {
    getUserMock
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
        error: null,
      });

    renderLoginPrompt();

    await waitFor(() => {
      expect(getUserMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(persistedPageShowEvent());
    });

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=login",
      );
    });
  });
});
