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
      pageHeading="다시 오신 걸 환영해요"
      formSubtitle="계속하려면 로그인하세요"
      heroEyebrow="로그인"
      mascotAlt="로그인 캐릭터"
      switchPrompt="계정이 없나요?"
      switchHref="/sign-up"
      switchLabel="회원가입"
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

  it("replaces authenticated auth entry pages with the dashboard on mount", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });

    renderLoginPrompt();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/dashboard");
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
      expect(routerReplaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
