// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IntlAntdWrapper,
  renderWithIntl,
} from "../../test-utils/renderWithIntl";

const helpers = vi.hoisted(() => ({
  replace: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: helpers.replace,
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      setSession: helpers.setSession,
    },
  }),
}));

import { CallbackFragmentFallback } from "../../../src/components/auth/CallbackFragmentFallback";

describe("CallbackFragmentFallback", () => {
  beforeEach(() => {
    helpers.replace.mockReset();
    helpers.setSession.mockReset();
    window.history.replaceState(
      null,
      "",
      "/auth/callback-fragment?next=%2Fterms",
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("removes the token fragment before starting the async session exchange", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback-fragment?next=%2Fterms#access_token=access-secret&refresh_token=refresh-secret&type=signup",
    );
    let releaseSession: (() => void) | undefined;
    let locationAtSetSession:
      | { hash: string; pathname: string; search: string }
      | undefined;
    helpers.setSession.mockImplementation(() => {
      locationAtSetSession = {
        hash: window.location.hash,
        pathname: window.location.pathname,
        search: window.location.search,
      };
      return new Promise((resolve) => {
        releaseSession = () => resolve({ error: null });
      });
    });

    renderWithIntl(<CallbackFragmentFallback next="/terms" />);

    await waitFor(() => {
      expect(helpers.setSession).toHaveBeenCalledTimes(1);
    });
    expect(locationAtSetSession).toEqual({
      hash: "",
      pathname: "/auth/callback-fragment",
      search: "?next=%2Fterms",
    });
    expect(window.location.href).not.toContain("access-secret");
    expect(window.location.href).not.toContain("refresh-secret");

    releaseSession?.();
  });

  it("removes a provider error fragment before routing to the canonical error", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback-fragment?next=%2Fterms#error_code=otp_expired&error_description=provider-secret",
    );
    let hrefAtReplace = "";
    helpers.replace.mockImplementation(() => {
      hrefAtReplace = window.location.href;
    });

    renderWithIntl(<CallbackFragmentFallback next="/terms" />);

    await waitFor(() => {
      expect(helpers.replace).toHaveBeenCalledWith(
        "/auth/error?reason=otp_expired",
      );
    });
    expect(hrefAtReplace).toBe(
      "http://localhost:3000/auth/callback-fragment?next=%2Fterms",
    );
    expect(hrefAtReplace).not.toContain("provider-secret");
  });

  it("reuses one delayed fragment exchange across the StrictMode effect lifecycle", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback-fragment?next=%2Fterms#access_token=access-secret&refresh_token=refresh-secret&type=signup",
    );
    let releaseSession: (() => void) | undefined;
    helpers.setSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSession = () => resolve({ error: null });
        }),
    );

    render(
      <StrictMode>
        <CallbackFragmentFallback next="/terms" />
      </StrictMode>,
      { wrapper: IntlAntdWrapper },
    );

    await waitFor(() => {
      expect(helpers.setSession).toHaveBeenCalledTimes(1);
    });
    expect(helpers.replace).not.toHaveBeenCalledWith(
      "/auth/error?reason=unknown",
    );

    releaseSession?.();

    await waitFor(() => {
      expect(helpers.replace).toHaveBeenCalledWith("/terms");
    });
    expect(helpers.setSession).toHaveBeenCalledTimes(1);
    expect(helpers.replace).not.toHaveBeenCalledWith(
      "/auth/error?reason=unknown",
    );
  });

  it("uses a full clean-location replacement when synchronous fragment scrubbing fails", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback-fragment?next=%2Fterms#access_token=access-secret&refresh_token=refresh-secret",
    );
    const replaceState = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {
        throw new Error("history unavailable provider-secret");
      });
    const locationReplace = vi.fn();
    const fallbackWindow = Object.create(window) as Window & typeof globalThis;
    Object.defineProperty(fallbackWindow, "location", {
      configurable: true,
      value: {
        hash: window.location.hash,
        pathname: window.location.pathname,
        replace: locationReplace,
        search: window.location.search,
      } satisfies Pick<Location, "hash" | "pathname" | "replace" | "search">,
    });
    Object.defineProperty(fallbackWindow, "history", {
      configurable: true,
      value: window.history,
    });
    vi.stubGlobal("window", fallbackWindow);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    renderWithIntl(<CallbackFragmentFallback next="/terms" />);

    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledTimes(1);
      expect(locationReplace).toHaveBeenCalledWith(
        "/auth/callback-fragment?next=%2Fterms",
      );
    });
    expect(helpers.setSession).not.toHaveBeenCalled();
    expect(helpers.replace).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "access-secret",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "refresh-secret",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "provider-secret",
    );
  });

  it("recovers a rejected session exchange without logging secrets or leaking a rejection", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback-fragment?next=%2Fterms#access_token=access-secret&refresh_token=refresh-secret",
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    helpers.setSession.mockRejectedValue(
      new Error("provider rejected access-secret refresh-secret"),
    );

    renderWithIntl(<CallbackFragmentFallback next="/terms" />);

    await waitFor(() => {
      expect(helpers.replace).toHaveBeenCalledWith(
        "/auth/error?reason=unknown",
      );
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "access-secret",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "refresh-secret",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "provider rejected",
    );
  });
});
