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

  it("opens the shared Google linked message and removes the query flag", async () => {
    noticeValue = "google-linked";

    const { container } = renderWithIntl(<AuthIdentityNotice />);

    expect(container.textContent).toBe("");
    await waitFor(() => {
      expect(document.body.querySelector(".ant-message-notice")).toBeTruthy();
    });
    expect(document.body.querySelector(".ant-notification-notice")).toBeNull();
    expect(await screen.findByText("Google 계정이 연결됐어요.")).toBeTruthy();
    expect(replaceMock).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("renders nothing for unknown notice values", () => {
    noticeValue = "raw-provider-error";

    const { container } = renderWithIntl(<AuthIdentityNotice />);

    expect(container.textContent).toBe("");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
