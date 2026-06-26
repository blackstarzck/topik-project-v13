// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

const navMock = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navMock.replace }),
  useSearchParams: () => navMock.searchParams,
}));

import { AccountDeletionCard } from "../../../src/components/profile/AccountDeletionCard";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

function openModal() {
  fireEvent.click(screen.getByTestId("account-delete-open"));
}

describe("AccountDeletionCard", () => {
  beforeEach(() => {
    navMock.replace.mockReset();
    navMock.searchParams = new URLSearchParams();
  });

  afterEach(() => cleanup());

  it("renders the danger-zone title and delete trigger", () => {
    const { container } = renderWithIntl(<AccountDeletionCard />);
    expect(screen.getByTestId("account-delete-open")).toBeTruthy();
    expect(container.querySelector(".account-delete-section")).toBeTruthy();
    expect(container.querySelector(".account-delete-actions")).toBeTruthy();
    // ko 카탈로그의 settings.account.dangerZone.title
    expect(screen.getAllByText("회원 탈퇴").length).toBeGreaterThan(0);
  });

  it("keeps the account deletion area visually separated and right-aligns its action", () => {
    const css = readFileSync("src/styles/global.css", "utf8");

    expect(css).toMatch(
      /\.account-delete-section\s*\{[\s\S]*?margin-top:\s*64px;/,
    );
    expect(css).toMatch(
      /\.account-delete-actions\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*flex-end;/,
    );
  });

  it("posts the deletion form to the account-delete route handler", async () => {
    renderWithIntl(<AccountDeletionCard />);
    openModal();

    const submit = (await screen.findByTestId(
      "account-delete-confirm-submit",
    )) as HTMLButtonElement;
    const form = submit.closest("form");
    expect(form?.getAttribute("action")).toBe("/auth/account-delete");
    expect(form?.getAttribute("method")).toBe("post");
  });

  it("keeps the confirm button disabled until the keyword is typed exactly", async () => {
    renderWithIntl(<AccountDeletionCard />);
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

    // 정확한 키워드(ko: "삭제") 입력 시 활성화.
    fireEvent.change(input, { target: { value: "삭제" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
  });

  it("prevents native form submission until the keyword matches (Enter-key bypass guard)", async () => {
    renderWithIntl(<AccountDeletionCard />);
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
    const { baseElement } = renderWithIntl(<AccountDeletionCard />);
    openModal();

    await screen.findByTestId("account-delete-confirm-submit");
    const cancel = await screen.findByText("취소");
    fireEvent.click(cancel);

    // open → false 시 AntD 가 leave 애니메이션 클래스를 동기 적용한다(jsdom 은
    // transitionend 를 안 쏴 노드 제거는 안 되므로, 닫힘 신호를 클래스로 확인).
    await waitFor(() =>
      expect(baseElement.querySelector(".ant-modal.ant-zoom-leave")).toBeTruthy(),
    );
  });
});
