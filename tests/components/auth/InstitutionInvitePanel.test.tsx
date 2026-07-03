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

const replaceMock = vi.fn();
const getUserMock = vi.fn();
const signOutMock = vi.fn();
const maybeSingleMock = vi.fn();
const readStoredAffiliationCodeMock = vi.fn();
const clearStoredAffiliationCodeMock = vi.fn();
const acceptStoredAffiliationInviteMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => maybeSingleMock(...args),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/auth/affiliation-code", () => ({
  acceptStoredAffiliationInvite: (...args: unknown[]) =>
    acceptStoredAffiliationInviteMock(...args),
  clearStoredAffiliationCode: (...args: unknown[]) =>
    clearStoredAffiliationCodeMock(...args),
  readStoredAffiliationCode: (...args: unknown[]) =>
    readStoredAffiliationCodeMock(...args),
}));

import { InstitutionInvitePanel } from "../../../src/components/auth/InstitutionInvitePanel";

function renderPanel(nextPath = "/dashboard") {
  return renderWithIntl(<InstitutionInvitePanel nextPath={nextPath} />);
}

beforeEach(() => {
  replaceMock.mockReset();
  getUserMock.mockReset();
  signOutMock.mockReset();
  maybeSingleMock.mockReset();
  readStoredAffiliationCodeMock.mockReset();
  clearStoredAffiliationCodeMock.mockReset();
  acceptStoredAffiliationInviteMock.mockReset();
  readStoredAffiliationCodeMock.mockReturnValue("EXPO2026-BOOTH-A");
  getUserMock.mockResolvedValue({ data: { user: null }, error: null });
  signOutMock.mockResolvedValue({ error: null });
  maybeSingleMock.mockResolvedValue({
    data: { affiliation_code: null },
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

describe("InstitutionInvitePanel", () => {
  it("keeps the invite content groups generously spaced", () => {
    const globalCss = readFileSync(
      path.join(process.cwd(), "src/styles/global.css"),
      "utf8",
    );

    expect(globalCss).toMatch(
      /\.institution-invite-stack\s*{[\s\S]*?gap:\s*32px;/,
    );
    expect(globalCss).toMatch(
      /\.institution-invite-stack\s*>\s*\.institution-invite-result:first-child\s*{[\s\S]*?margin-bottom:\s*24px;/,
    );
  });

  it("shows anonymous choices without treating the visitor as a non-member", async () => {
    const { container } = renderPanel();

    expect(await screen.findByText("기관 연결 후 달라지는 점")).toBeTruthy();
    expect(
      container.querySelector(".institution-invite-page--white"),
    ).toBeTruthy();
    expect(container.querySelector(".institution-invite-panel")).toBeTruthy();
    expect(container.querySelector(".institution-invite-card")).toBeNull();
    expect(
      container.querySelector(".institution-invite-panel.ant-card"),
    ).toBeNull();
    expect(
      container.querySelector(".institution-invite-policy--plain"),
    ).toBeTruthy();
    expect(
      container.querySelector(".institution-invite-actions-grid"),
    ).toBeTruthy();
    expect(
      container.querySelector(".institution-invite-action-primary"),
    ).toBeTruthy();
    expect(
      container.querySelector(".institution-invite-action-secondary"),
    ).toBeTruthy();
    expect(
      container.querySelector(".institution-invite-action-tertiary"),
    ).toBeTruthy();
    expect(screen.getByText("기존 학습 기록은 보존됩니다.")).toBeTruthy();
    expect(
      screen.getByText(
        "기관 연결 후 새 문제 탐색, 추천, 제출, 다시 풀기는 현재 기관에 배정된 문제 기준으로 제공됩니다.",
      ),
    ).toBeTruthy();

    expect(
      (
        await screen.findByRole("link", {
          name: "새 계정으로 가입하고 기관에 연결",
        })
      ).getAttribute("href"),
    ).toBe("/sign-up");
    expect(
      screen
        .getByRole("link", { name: "기존 계정으로 로그인" })
        .getAttribute("href"),
    ).toBe("/login?next=%2Fauth%2Finstitution-invite");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "초대 없이 계속하기" }),
      );
    });

    expect(clearStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(acceptStoredAffiliationInviteMock).not.toHaveBeenCalled();
  });

  it("accepts the invite only after an authenticated user clicks the explicit CTA", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    acceptStoredAffiliationInviteMock.mockResolvedValueOnce("accepted");

    renderPanel("/dashboard");

    await screen.findByText("learner@example.com");
    expect(screen.getByText("기관 연결 후 달라지는 점")).toBeTruthy();
    expect(screen.getByText("기존 학습 기록은 보존됩니다.")).toBeTruthy();
    expect(
      screen.getByText(
        "기관에 배정되지 않은 기존 문제는 읽기 전용 이력으로만 접근할 수 있고, 새 풀이 또는 재제출은 허용되지 않습니다.",
      ),
    ).toBeTruthy();
    expect(acceptStoredAffiliationInviteMock).not.toHaveBeenCalled();

    const consentCheckbox = screen.getByRole("checkbox", {
      name: "동의하시겠습니까?",
    });
    const acceptButton = screen.getByRole("button", {
      name: "기관에 연결",
    }) as HTMLButtonElement;
    expect(acceptButton.disabled).toBe(true);

    await act(async () => {
      fireEvent.click(consentCheckbox);
    });

    expect(acceptButton.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(acceptButton);
    });

    await waitFor(() => {
      expect(acceptStoredAffiliationInviteMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("기관 연결이 완료됐어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("declines an authenticated invite by clearing the stored code and continuing", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });

    renderPanel("/dashboard");

    await screen.findByText("learner@example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "연결하지 않고 계속" }));
    });

    expect(clearStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    expect(acceptStoredAffiliationInviteMock).not.toHaveBeenCalled();
  });

  it("blocks automatic switching when the account already belongs to another institution", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValueOnce({
      data: { affiliation_code: "OTHER-INSTITUTION" },
      error: null,
    });

    renderPanel("/dashboard");

    expect(
      await screen.findByText("이미 다른 기관에 연결되어 있어요"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "기관에 연결",
      }),
    ).toBeNull();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "다른 계정으로 로그인" }),
      );
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearStoredAffiliationCodeMock).not.toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith(
      "/login?next=%2Fauth%2Finstitution-invite",
    );
  });

  it("clears the stored code when an already-affiliated learner continues without connecting", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValueOnce({
      data: { affiliation_code: "OTHER-INSTITUTION" },
      error: null,
    });
    const { container } = renderPanel("/dashboard");

    await waitFor(() => {
      expect(
        screen.getByTestId("institution-invite-already-other-primary"),
      ).toBeTruthy();
    });
    const continueLink = container.querySelector(
      ".institution-invite-action-anchor",
    ) as HTMLAnchorElement | null;
    expect(continueLink).toBeTruthy();

    await act(async () => {
      fireEvent.click(continueLink as HTMLAnchorElement);
    });

    expect(clearStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("clears the stored code when an invalid invite result continues without connecting", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    acceptStoredAffiliationInviteMock.mockResolvedValueOnce("invalid");
    const { container } = renderPanel("/dashboard");

    await screen.findByText("learner@example.com");
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(
        container.querySelector(
          ".institution-invite-action-primary",
        ) as HTMLButtonElement,
      );
    });
    await waitFor(() => {
      expect(acceptStoredAffiliationInviteMock).toHaveBeenCalledTimes(1);
      expect(
        container.querySelector(".institution-invite-action-primary"),
      ).toBeNull();
    });

    const continueLink = container.querySelector(
      ".institution-invite-action-anchor",
    ) as HTMLAnchorElement | null;
    expect(continueLink).toBeTruthy();

    await act(async () => {
      fireEvent.click(continueLink as HTMLAnchorElement);
    });

    expect(clearStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("clears the stored code when a failed invite state continues without connecting", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "profile lookup failed" },
    });
    const { container } = renderPanel("/dashboard");

    await waitFor(() => {
      expect(
        container.querySelector(".institution-invite-action-anchor"),
      ).toBeTruthy();
    });
    const continueLink = container.querySelector(
      ".institution-invite-action-anchor",
    ) as HTMLAnchorElement | null;
    expect(continueLink).toBeTruthy();

    await act(async () => {
      fireEvent.click(continueLink as HTMLAnchorElement);
    });

    expect(clearStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders the success result on a pure white page background", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    acceptStoredAffiliationInviteMock.mockResolvedValueOnce("accepted");
    const { container } = renderPanel("/dashboard");

    await screen.findByText("learner@example.com");
    const acceptButton = container.querySelector(
      ".institution-invite-actions .ant-btn-primary",
    ) as HTMLButtonElement | null;
    expect(acceptButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", { name: "동의하시겠습니까?" }),
      );
      fireEvent.click(acceptButton as HTMLButtonElement);
    });

    await waitFor(() => {
      expect(
        container.querySelector(".institution-invite-page--white"),
      ).toBeTruthy();
    });
  });

  it("renders the other-institution result on white with a flat priority action", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });
    maybeSingleMock.mockResolvedValueOnce({
      data: { affiliation_code: "OTHER-INSTITUTION" },
      error: null,
    });
    const { container } = renderPanel("/dashboard");

    await waitFor(() => {
      expect(
        container.querySelector(".institution-invite-page--white"),
      ).toBeTruthy();
    });
    const priorityAction = screen.getByTestId(
      "institution-invite-already-other-primary",
    );
    expect(priorityAction.className).toContain(
      "institution-invite-flat-action",
    );
  });

  it("shows a dashboard login CTA when an anonymous invite code is missing or expired", async () => {
    readStoredAffiliationCodeMock.mockReturnValueOnce(null);

    renderPanel();

    expect(
      await screen.findByText("초대 코드가 없거나 만료됐어요"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "기존 계정으로 로그인" })
        .getAttribute("href"),
    ).toBe("/login?next=%2Fdashboard");
    expect(acceptStoredAffiliationInviteMock).not.toHaveBeenCalled();
  });

  it("sends an authenticated user with a missing or expired invite code to the dashboard", async () => {
    readStoredAffiliationCodeMock.mockReturnValueOnce(null);
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "learner@example.com" } },
      error: null,
    });

    renderPanel();

    expect(
      await screen.findByText("초대 코드가 없거나 만료됐어요"),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "대시보드로 이동" }));
    });

    expect(clearStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    expect(acceptStoredAffiliationInviteMock).not.toHaveBeenCalled();
  });
});
