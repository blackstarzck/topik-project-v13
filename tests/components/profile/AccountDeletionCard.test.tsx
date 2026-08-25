// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import enMessages from "../../../messages/en.json";
import koMessages from "../../../messages/ko.json";
import viMessages from "../../../messages/vi.json";

const navMock = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));
const recoveryCleanupMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navMock.replace }),
  useSearchParams: () => navMock.searchParams,
}));

vi.mock("@/lib/writing/client-recovery-cleanup", () => ({
  clearClientRecoveryForAccountDeletion: recoveryCleanupMock,
}));

import { AccountDeletionCard } from "../../../src/components/profile/AccountDeletionCard";
import AccountSettingsLoading from "../../../src/app/(workspace)/settings/account/loading";
import { ACCOUNT_DELETION_CONFIRMATION_TEXT } from "../../../src/lib/auth/account-deletion";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

function openModal() {
  fireEvent.click(screen.getByTestId("account-delete-open"));
}

describe("AccountDeletionCard", () => {
  beforeEach(() => {
    navMock.replace.mockReset();
    navMock.searchParams = new URLSearchParams();
    recoveryCleanupMock.mockReset();
    recoveryCleanupMock.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the danger-zone title and delete trigger", () => {
    const { container } = renderWithIntl(
      <AccountDeletionCard userId="user-1" />,
    );
    const openButton = screen.getByTestId("account-delete-open");
    expect(openButton).toBeTruthy();
    expect(openButton.classList.contains("ant-btn-primary")).toBe(true);
    expect(openButton.classList.contains("ant-btn-dangerous")).toBe(true);
    expect(container.querySelector(".account-delete-section")).toBeTruthy();
    expect(
      container.querySelector(
        ".account-delete-card.app-card.app-surface",
      ),
    ).toBeTruthy();
    expect(container.querySelector(".account-delete-actions")).toBeTruthy();
    // ko 카탈로그의 settings.account.dangerZone.title
    expect(screen.getAllByText("회원 탈퇴").length).toBeGreaterThan(0);
  });

  it("keeps the loading danger-zone card on the same stable class", () => {
    const { container } = renderWithIntl(<AccountSettingsLoading />);

    expect(
      container.querySelector(
        ".account-delete-card.app-card.app-surface",
      ),
    ).toBeTruthy();
  });

  it("keeps the account deletion area visually separated and right-aligns its action", () => {
    const css = readFileSync("src/styles/global.css", "utf8");

    expect(css).toMatch(
      /\.account-delete-section\s*\{[\s\S]*?margin-top:\s*64px;/,
    );
    expect(css).toMatch(
      /\.account-delete-actions\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*flex-end;/,
    );
    expect(css).toMatch(
      /\.account-delete-card\.app-card\.app-surface\s*\{[\s\S]*?border:\s*1px solid var\(--app-color-status-error-border\);[\s\S]*?background:\s*var\(--app-color-status-error-surface\);/,
    );
  });

  it("posts the deletion form to the account-delete route handler", async () => {
    renderWithIntl(<AccountDeletionCard userId="user-1" />);
    openModal();

    const submit = (await screen.findByTestId(
      "account-delete-confirm-submit",
    )) as HTMLButtonElement;
    const form = submit.closest("form");
    expect(form?.getAttribute("action")).toBe("/auth/account-delete");
    expect(form?.getAttribute("method")).toBe("post");
    expect(
      (screen.getByTestId("account-delete-confirm-input") as HTMLInputElement)
        .name,
    ).toBe("confirmation");
  });

  it("keeps the confirm button disabled until the keyword is typed exactly", async () => {
    renderWithIntl(<AccountDeletionCard userId="user-1" />);
    openModal();

    const submit = (await screen.findByTestId(
      "account-delete-confirm-submit",
    )) as HTMLButtonElement;
    const input = screen.getByTestId(
      "account-delete-confirm-input",
    ) as HTMLInputElement;

    // 초기/오입력 상태는 비활성.
    expect(submit.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "삭" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, {
      target: { value: ` ${ACCOUNT_DELETION_CONFIRMATION_TEXT.ko} ` },
    });
    expect(submit.disabled).toBe(true);

    // 정확한 키워드(ko: "삭제") 입력 시 활성화.
    fireEvent.change(input, {
      target: { value: ACCOUNT_DELETION_CONFIRMATION_TEXT.ko },
    });
    await waitFor(() => expect(submit.disabled).toBe(false));
  });

  it.each([
    ["en", ACCOUNT_DELETION_CONFIRMATION_TEXT.en],
    ["vi", ACCOUNT_DELETION_CONFIRMATION_TEXT.vi],
  ] as const)(
    "uses the current %s locale confirmation keyword",
    async (locale, keyword) => {
      renderWithIntl(<AccountDeletionCard userId="user-1" />, { locale });
      openModal();

      const submit = (await screen.findByTestId(
        "account-delete-confirm-submit",
      )) as HTMLButtonElement;
      const input = screen.getByTestId("account-delete-confirm-input");

      fireEvent.change(input, {
        target: { value: ACCOUNT_DELETION_CONFIRMATION_TEXT.ko },
      });
      expect(submit.disabled).toBe(true);

      fireEvent.change(input, { target: { value: keyword } });
      await waitFor(() => expect(submit.disabled).toBe(false));
    },
  );

  it("keeps approved confirmation keywords aligned with message catalogs", () => {
    expect(ACCOUNT_DELETION_CONFIRMATION_TEXT).toEqual({
      ko: koMessages.settings.account.dangerZone.confirmKeyword,
      en: enMessages.settings.account.dangerZone.confirmKeyword,
      vi: viMessages.settings.account.dangerZone.confirmKeyword,
    });
  });

  it("prevents native form submission until the keyword matches (Enter-key bypass guard)", async () => {
    renderWithIntl(<AccountDeletionCard userId="user-1" />);
    openModal();

    const submit = (await screen.findByTestId(
      "account-delete-confirm-submit",
    )) as HTMLButtonElement;
    const form = submit.closest("form") as HTMLFormElement;

    // 키워드 미입력 상태의 폼 제출(예: Enter 키)은 preventDefault 되어야 한다
    // (fireEvent.submit 은 이벤트가 취소되면 false 를 반환).
    expect(fireEvent.submit(form)).toBe(false);

    // 틀린 키워드도 동일하게 차단.
    fireEvent.change(screen.getByTestId("account-delete-confirm-input"), {
      target: { value: "틀린값" },
    });
    expect(fireEvent.submit(form)).toBe(false);
  });

  it("closes the modal on cancel", async () => {
    const { baseElement } = renderWithIntl(
      <AccountDeletionCard userId="user-1" />,
    );
    openModal();

    await screen.findByTestId("account-delete-confirm-submit");
    const cancel = await screen.findByText("취소");
    fireEvent.click(cancel);

    // open → false 시 AntD 가 leave 애니메이션 클래스를 동기 적용한다(jsdom 은
    // transitionend 를 안 쏴 노드 제거는 안 되므로, 닫힘 신호를 클래스로 확인).
    await waitFor(() =>
      expect(
        baseElement.querySelector(".ant-modal.ant-zoom-leave"),
      ).toBeTruthy(),
    );
  });

  it("clears all user recovery records only after server-confirmed deletion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithIntl(<AccountDeletionCard userId="user-1" />);
    openModal();
    fireEvent.change(screen.getByTestId("account-delete-confirm-input"), {
      target: { value: ACCOUNT_DELETION_CONFIRMATION_TEXT.ko },
    });
    const submit = await screen.findByTestId("account-delete-confirm-submit");
    fireEvent.submit(submit.closest("form") as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("confirmation")).toBe(
      ACCOUNT_DELETION_CONFIRMATION_TEXT.ko,
    );
    expect(recoveryCleanupMock).toHaveBeenCalledWith("user-1");
    await waitFor(() =>
      expect(navMock.replace).toHaveBeenCalledWith("/login?reason=withdrawn"),
    );
  });

  it("keeps recovery records when account deletion is not confirmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), {
        headers: { "content-type": "application/json" },
        status: 503,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithIntl(<AccountDeletionCard userId="user-1" />);
    openModal();
    fireEvent.change(screen.getByTestId("account-delete-confirm-input"), {
      target: { value: ACCOUNT_DELETION_CONFIRMATION_TEXT.ko },
    });
    const submit = await screen.findByTestId("account-delete-confirm-submit");
    fireEvent.submit(submit.closest("form") as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(recoveryCleanupMock).not.toHaveBeenCalled();
    expect(navMock.replace).not.toHaveBeenCalledWith("/login?reason=withdrawn");
  });

  it("retries only local cleanup when deletion succeeded but cleanup failed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    recoveryCleanupMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    renderWithIntl(<AccountDeletionCard userId="user-1" />);
    openModal();
    fireEvent.change(screen.getByTestId("account-delete-confirm-input"), {
      target: { value: ACCOUNT_DELETION_CONFIRMATION_TEXT.ko },
    });
    const submit = await screen.findByTestId("account-delete-confirm-submit");
    fireEvent.submit(submit.closest("form") as HTMLFormElement);

    await waitFor(() => expect(recoveryCleanupMock).toHaveBeenCalledTimes(1));
    expect(navMock.replace).not.toHaveBeenCalledWith("/login?reason=withdrawn");
    expect(await screen.findByText("다시 시도")).toBeTruthy();

    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    await waitFor(() => expect(recoveryCleanupMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(navMock.replace).toHaveBeenCalledWith("/login?reason=withdrawn"),
    );
  });
});
