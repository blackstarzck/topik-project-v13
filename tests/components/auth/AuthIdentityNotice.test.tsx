// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

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
  });

  it("renders the Google linked notice and removes the query flag", () => {
    noticeValue = "google-linked";

    renderWithIntl(<AuthIdentityNotice />);

    expect(screen.getByText("Google 로그인이 계정에 연결됐어요.")).toBeTruthy();
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
