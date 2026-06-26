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

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "email" ? "u@example.com" : null),
  }),
}));

import { VerifyEmailCard } from "../../../src/components/auth/VerifyEmailCard";

const renderInApp = renderWithIntl;

beforeEach(() => {
  resendMock.mockReset();
  resendMock.mockResolvedValue({ error: null });
  buildAuthRedirectUrlMock.mockReset();
  buildAuthRedirectUrlMock.mockImplementation(
    (path: string) => `https://talkpik.example.com${path}`,
  );
  // 60초 재전송 cooldown이 localStorage(talkpik:verify-email:cooldown-until)에
  // 남으면 다음 테스트의 버튼이 disabled로 시작한다 — 테스트마다 초기화.
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("VerifyEmailCard", () => {
  it("presents email verification as the primary task and keeps account actions secondary", () => {
    renderInApp(<VerifyEmailCard />);

    expect(
      screen.getByRole("heading", { name: "인증 메일을 보냈어요" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "가입 요청을 확인했어요. 새 계정이면 아래 이메일로 인증 메일이 도착해요. 메일의 링크를 눌러 가입을 마무리해주세요.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("가입 이메일:")).toBeTruthy();
    expect(screen.getByText("u@example.com")).toBeTruthy();
    expect(screen.getByTestId("verify-email-summary")).toBeTruthy();
    expect(
      screen.getByTestId("verify-email-summary").querySelector("svg"),
    ).toBeNull();
    expect(screen.getByTestId("verify-email-card").className).toContain(
      "verify-email-card",
    );
    expect(screen.getByLabelText("인증 메일을 받을 이메일")).toBeTruthy();
    expect(
      screen.getByTestId("verify-email-existing-account-actions"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("verify-email-frequent-note").querySelector("svg"),
    ).toBeNull();
    expect(screen.getByText("이미 계정이 있나요?")).toBeTruthy();
    expect(
      document.querySelectorAll(".verify-email-support__heading svg"),
    ).toHaveLength(0);
    expect(screen.queryByText(/이미 가입된 이메일/)).toBeNull();
    expect(screen.queryByText(/계정이 존재/)).toBeNull();
  });

  it("keeps secondary action buttons in equal-width pairs", () => {
    renderInApp(<VerifyEmailCard />);

    expect(screen.getByTestId("verify-email-help-actions").className).toContain(
      "grid-cols-2",
    );
    expect(
      screen.getByTestId("verify-email-existing-account-button-row").className,
    ).toContain("grid-cols-2");

    expect(
      screen.getByTestId("verify-email-sign-up-different").className,
    ).toContain("w-full");
    expect(screen.getByTestId("verify-email-login").className).toContain(
      "w-full",
    );
    expect(screen.getByTestId("verify-email-password-reset").className).toContain(
      "w-full",
    );
    expect(
      screen.getByTestId("verify-email-password-reset").getAttribute("href"),
    ).toBe("/password-reset?email=u%40example.com");
  });

  it("resends the verification email with the callback redirect URL", async () => {
    renderInApp(<VerifyEmailCard />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("verify-email-resend"));
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
    renderInApp(<VerifyEmailCard />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("verify-email-resend"));
    });

    await waitFor(() => {
      expect(screen.getByText(/재전송에 실패했어요/)).toBeTruthy();
    });
    // throw는 URL 빌드 단계에서 발생 — supabase 호출 자체가 없어야 한다.
    expect(resendMock).not.toHaveBeenCalled();
    // 버튼 영구 로딩(D-2) 회귀 방지: finally가 resending을 해제해야 한다.
    const button = screen.getByTestId("verify-email-resend");
    expect(button.className).not.toContain("ant-btn-loading");
  });
});
