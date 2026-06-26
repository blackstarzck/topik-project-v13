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

const resendMock = vi.fn();
const buildAuthRedirectUrlMock = vi.fn();
const pushMock = vi.fn();
const searchParamsState = vi.hoisted(() => ({
  email: "u@example.com",
  reason: "email_not_confirmed",
  retryAfterSeconds: null as string | null,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      resend: (...args: unknown[]) => resendMock(...args),
    },
  }),
}));

// D-2 (QA 2026-06-12): buildAuthRedirectUrl은 NEXT_PUBLIC_SITE_URL 부재 시 동기
// throw — throw 경로를 단위에서 재현하기 위해 모듈을 mock으로 대체한다. 기본
// 구현은 실제 빌더와 같은 절대 URL을 돌려준다.
vi.mock("@/lib/auth/redirect-url", () => ({
  buildAuthRedirectUrl: (path: string) => buildAuthRedirectUrlMock(path),
}));

// reason=email_not_confirmed: primary CTA가 resend이고 이메일 입력 필드가
// 노출되는 reason — 재전송 핸들러를 직접 구동할 수 있다.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "reason") return searchParamsState.reason;
      if (key === "email") return searchParamsState.email;
      if (key === "retry_after_seconds")
        return searchParamsState.retryAfterSeconds;
      return null;
    },
  }),
}));

import { AuthErrorCard } from "../../../src/components/auth/AuthErrorCard";

const renderInApp = renderWithIntl;

beforeEach(() => {
  searchParamsState.email = "u@example.com";
  searchParamsState.reason = "email_not_confirmed";
  searchParamsState.retryAfterSeconds = null;
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
  pushMock.mockReset();
  buildAuthRedirectUrlMock.mockReset();
  buildAuthRedirectUrlMock.mockImplementation(
    (path: string) => `https://talkpik.example.com${path}`,
  );
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("AuthErrorCard", () => {
  it("keeps user_not_found neutral and does not render untrusted email from the URL", () => {
    searchParamsState.reason = "user_not_found";
    searchParamsState.email = "deleted@example.com";

    renderInApp(<AuthErrorCard />);

    expect(
      screen.getByRole("heading", { name: "이 링크로는 계속할 수 없어요" }),
    ).toBeTruthy();
    expect(screen.queryByText("deleted@example.com")).toBeNull();
    expect(screen.queryByLabelText("이메일")).toBeNull();
    expect(screen.queryByText(/계정은 더 이상 존재/)).toBeNull();
    expect(screen.queryByText(/계정이 존재/)).toBeNull();
  });

  it("resends the verification email with the callback redirect URL", async () => {
    renderInApp(<AuthErrorCard />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("auth-error-primary"));
    });

    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledTimes(1);
    });
    const call = resendMock.mock.calls[0][0];
    expect(call.type).toBe("signup");
    expect(call.email).toBe("u@example.com");
    expect(call.options.emailRedirectTo).toBe(
      "https://talkpik.example.com/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
    await waitFor(() => {
      expect(
        screen.getByText(
          "인증 메일을 다시 보냈어요. 받은편지함을 확인해주세요.",
        ),
      ).toBeTruthy();
    });
  });

  it("clears loading and shows an error when the redirect URL builder throws (D-2)", async () => {
    buildAuthRedirectUrlMock.mockImplementation(() => {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required in non-development environments",
      );
    });
    renderInApp(<AuthErrorCard />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("auth-error-primary"));
    });

    await waitFor(() => {
      expect(screen.getByText(/재전송에 실패했어요/)).toBeTruthy();
    });
    // throw는 URL 빌드 단계에서 발생 — supabase 호출 자체가 없어야 한다.
    expect(resendMock).not.toHaveBeenCalled();
    // 버튼 영구 로딩(D-2) 회귀 방지: finally가 resending을 해제해야 한다.
    const button = screen.getByTestId("auth-error-primary");
    expect(button.className).not.toContain("ant-btn-loading");
  });
});
