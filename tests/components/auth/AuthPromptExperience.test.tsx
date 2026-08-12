// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const getUserMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerPushMock = vi.fn();
const LOGO_SRC = "/assets/logo.png";
const GLOBAL_CSS = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
let searchParamsMock = new URLSearchParams();

function decodedImageSrc(image: HTMLImageElement) {
  return decodeURIComponent(image.getAttribute("src") ?? "");
}

function getCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = GLOBAL_CSS.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
  );

  return match?.[1] ?? "";
}

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
  useSearchParams: () => searchParamsMock,
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
    searchParamsMock = new URLSearchParams();
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

  it("uses post-auth instead of a query next target for authenticated login entry pages", async () => {
    searchParamsMock = new URLSearchParams("next=/settings/account");
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

  it("renders the uploaded logo asset in desktop and mobile brand slots", () => {
    renderLoginPrompt();

    const logoImages = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".signup-brand img, .signup-prompt-mobile-brand img",
      ),
    );

    expect(logoImages).toHaveLength(2);
    expect(logoImages.map(decodedImageSrc)).toEqual([
      expect.stringContaining(LOGO_SRC),
      expect.stringContaining(LOGO_SRC),
    ]);
    expect(logoImages.map((image) => image.getAttribute("loading"))).toEqual([
      "eager",
      "eager",
    ]);
  });

  it("keeps the desktop hero panel viewport-bound independently from the form column", () => {
    const heroRule = getCssRule(".signup-prompt-hero");

    expect(heroRule).toContain("position: sticky");
    expect(heroRule).toContain("top: 0");
    expect(heroRule).toContain("align-self: start");
    expect(heroRule).toContain("height: 100dvh");
    expect(heroRule).toContain("max-height: 100dvh");
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
