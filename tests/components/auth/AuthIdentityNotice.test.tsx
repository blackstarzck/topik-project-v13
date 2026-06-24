// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const replaceMock = vi.fn();
let noticeValue: string | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({
    get: (key: string) => (key === "notice" ? noticeValue : null),
    toString: () =>
      noticeValue ? `notice=${encodeURIComponent(noticeValue)}` : "",
  }),
}));

import { AuthIdentityNotice } from "../../../src/components/auth/AuthIdentityNotice";

describe("AuthIdentityNotice", () => {
  beforeEach(() => {
    noticeValue = null;
    replaceMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("opens the shared Google linked notification and removes the query flag", async () => {
    noticeValue = "google-linked";

    const { container } = renderWithIntl(<AuthIdentityNotice />);

    expect(container.textContent).toBe("");
    await waitFor(() => {
      expect(
        document.body.querySelector(".ant-notification-notice"),
      ).toBeTruthy();
    });
    expect(
      await screen.findByText("Google 로그인이 계정에 연결됐어요."),
    ).toBeTruthy();
    expect(
      screen.getByText("다음부터 이메일 또는 Google로 로그인할 수 있어요."),
    ).toBeTruthy();
    expect(replaceMock).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("renders nothing for unknown notice values", () => {
    noticeValue = "raw-provider-error";

    const { container } = renderWithIntl(<AuthIdentityNotice />);

    expect(container.textContent).toBe("");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
