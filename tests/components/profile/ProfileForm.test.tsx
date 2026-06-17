// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import koMessages from "../../../messages/ko.json";

const {
  mutateAsyncMock,
  useUpdateProfileMock,
  checkNicknameAvailabilityMock,
  MockNicknameTakenError,
} = vi.hoisted(() => {
  const mutateAsyncMock = vi.fn();
  const useUpdateProfileMock = vi.fn();
  const checkNicknameAvailabilityMock = vi.fn();
  class MockNicknameTakenError extends Error {
    constructor() {
      super("이미 사용 중인 닉네임이에요.");
      this.name = "NicknameTakenError";
    }
  }
  return {
    mutateAsyncMock,
    useUpdateProfileMock,
    checkNicknameAvailabilityMock,
    MockNicknameTakenError,
  };
});

vi.mock("@/lib/settings/mutations", () => ({
  checkNicknameAvailability: (...args: unknown[]) =>
    checkNicknameAvailabilityMock(...args),
  NicknameTakenError: MockNicknameTakenError,
  useUpdateProfile: (...args: unknown[]) => useUpdateProfileMock(...args),
}));

import {
  ProfileForm,
  normalizeProfileField,
} from "../../../src/components/profile/ProfileForm";

const blankProfile = { display_name: null, nickname: null, bio: null };

// Components now call next-intl's useTranslations, so they must render inside a
// NextIntlClientProvider. Render against the real ko catalog (same Korean strings
// the assertions match) — never the ephemeral messages/_staging/ dir.
function renderInApp(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{node}</AntdApp>
    </NextIntlClientProvider>,
  );
}

function renderProfileForm(
  props: Partial<Parameters<typeof ProfileForm>[0]> = {},
) {
  return renderInApp(
    <ProfileForm
      userId="user-1"
      accountEmail="learner@example.com"
      initialProfile={blankProfile}
      {...props}
    />,
  );
}

function renderProfileFormWithNavigation(
  props: Partial<Parameters<typeof ProfileForm>[0]> = {},
) {
  return renderInApp(
    <>
      <a href="/dashboard">대시보드로 이동</a>
      <ProfileForm
        userId="user-1"
        accountEmail="learner@example.com"
        initialProfile={blankProfile}
        {...props}
      />
    </>,
  );
}

beforeEach(() => {
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue(undefined);
  checkNicknameAvailabilityMock.mockReset();
  checkNicknameAvailabilityMock.mockResolvedValue(true);
  useUpdateProfileMock.mockReset();
  useUpdateProfileMock.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: mutateAsyncMock,
    isPending: false,
  });

  if (!(globalThis as Record<string, unknown>).ResizeObserver) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
});

describe("normalizeProfileField (pure helper)", () => {
  it("returns null for empty strings", () => {
    expect(normalizeProfileField("")).toBeNull();
    expect(normalizeProfileField("   ")).toBeNull();
  });

  it("trims whitespace and returns the value", () => {
    expect(normalizeProfileField("  Chan  ")).toBe("Chan");
    expect(normalizeProfileField("Tester")).toBe("Tester");
  });
});

function submitForm(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("form element not found");
  fireEvent.submit(form);
}

describe("ProfileForm", () => {
  it("keeps Save disabled and does not submit when profile fields are unchanged", async () => {
    const { container } = renderProfileForm();

    const saveButton = screen.getByRole("button", { name: "프로필 저장" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      submitForm(container);
    });

    expect(useUpdateProfileMock).toHaveBeenCalledWith("user-1");
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("submits null when the user clears an existing value to empty string", async () => {
    const { container } = renderProfileForm({
      initialProfile: { display_name: "Chan", nickname: "chan-k", bio: null },
    });

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        display_name: null,
        nickname: "chan-k",
        bio: null,
      });
    });
  });

  it("submits trimmed values for display name and nickname", async () => {
    const { container } = renderProfileForm();

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    const nickInput = screen.getByLabelText("닉네임") as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "  Chan  " } });
    fireEvent.change(nickInput, { target: { value: "tester" } });

    await waitFor(() => {
      expect(screen.getByText(koMessages.profile.form.nicknameAvailable)).toBeTruthy();
    });

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        display_name: "Chan",
        nickname: "tester",
        bio: null,
      });
    });
  });

  it("submits bio (trimmed) when user types into the bio textarea", async () => {
    const { container } = renderProfileForm();

    const bioInput = screen.getByLabelText("자기소개") as HTMLTextAreaElement;
    fireEvent.change(bioInput, {
      target: { value: "  TOPIK II grade 4 goal  " },
    });

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        display_name: null,
        nickname: null,
        bio: "TOPIK II grade 4 goal",
      });
    });
  });

  it("matches IA field length limits", () => {
    renderProfileForm();

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    const nickInput = screen.getByLabelText("닉네임") as HTMLInputElement;
    const bioInput = screen.getByLabelText("자기소개") as HTMLTextAreaElement;

    expect(nameInput.maxLength).toBe(30);
    expect(nickInput.maxLength).toBe(20);
    expect(bioInput.maxLength).toBe(160);
  });

  it("blocks one-character display name and nickname values", async () => {
    const { container } = renderProfileForm();

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "A" } });

    expect(screen.getByText("이름은 2자 이상 입력해 주세요.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "프로필 저장" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      submitForm(container);
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: "An" } });
    const nickInput = screen.getByLabelText("닉네임") as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "B" } });

    expect(screen.getByText("닉네임은 2자 이상 입력해 주세요.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "프로필 저장" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("does not check duplicate nickname for one-character values", () => {
    renderProfileForm();

    const nickInput = screen.getByLabelText(
      koMessages.profile.form.nicknameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "B" } });

    expect(screen.getByText(koMessages.profile.form.nicknameTooShort)).toBeTruthy();
    expect(checkNicknameAvailabilityMock).not.toHaveBeenCalled();
  });

  it("shows available nickname feedback and enables Save after debounce", async () => {
    renderProfileForm();

    const nickInput = screen.getByLabelText(
      koMessages.profile.form.nicknameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "talkpik-new" } });

    await waitFor(
      () => {
        expect(checkNicknameAvailabilityMock).toHaveBeenCalledWith("talkpik-new");
      },
      { timeout: 1000 },
    );
    await waitFor(() => {
      expect(screen.getByText(koMessages.profile.form.nicknameAvailable)).toBeTruthy();
    });
    expect(
      (screen.getByRole("button", {
        name: koMessages.profile.form.saveAriaLabel,
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("shows duplicate nickname feedback and disables Save", async () => {
    checkNicknameAvailabilityMock.mockResolvedValue(false);
    renderProfileForm();

    const nickInput = screen.getByLabelText(
      koMessages.profile.form.nicknameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "talkpik-taken" } });

    await waitFor(() => {
      expect(screen.getByText(koMessages.profile.form.nicknameTaken)).toBeTruthy();
    });
    expect(
      (screen.getByRole("button", {
        name: koMessages.profile.form.saveAriaLabel,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows check-failed feedback but keeps Save available for DB-backed final validation", async () => {
    checkNicknameAvailabilityMock.mockRejectedValue(new Error("network"));
    renderProfileForm();

    const nickInput = screen.getByLabelText(
      koMessages.profile.form.nicknameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "talkpik-offline" } });

    await waitFor(() => {
      expect(screen.getByText(koMessages.profile.form.nicknameCheckFailed)).toBeTruthy();
    });
    expect(
      (screen.getByRole("button", {
        name: koMessages.profile.form.saveAriaLabel,
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("does not check duplicate nickname when the saved nickname is unchanged", () => {
    renderProfileForm({
      initialProfile: {
        display_name: null,
        nickname: "talkpik-saved",
        bio: null,
      },
    });

    expect(checkNicknameAvailabilityMock).not.toHaveBeenCalled();
  });

  it("ignores stale nickname availability responses", async () => {
    let resolveFirst: (value: boolean) => void = () => undefined;
    checkNicknameAvailabilityMock
      .mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(true);
    renderProfileForm();

    const nickInput = screen.getByLabelText(
      koMessages.profile.form.nicknameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "talkpik-old" } });
    await waitFor(() => {
      expect(checkNicknameAvailabilityMock).toHaveBeenCalledWith("talkpik-old");
    });

    fireEvent.change(nickInput, { target: { value: "talkpik-new" } });
    await waitFor(() => {
      expect(checkNicknameAvailabilityMock).toHaveBeenCalledWith("talkpik-new");
    });

    resolveFirst(false);
    await waitFor(() => {
      expect(screen.getByText(koMessages.profile.form.nicknameAvailable)).toBeTruthy();
    });
    expect(screen.queryByText(koMessages.profile.form.nicknameTaken)).toBeNull();
  });

  it("maps save-time nickname unique conflicts to field-level feedback", async () => {
    mutateAsyncMock.mockRejectedValue(new MockNicknameTakenError());
    const { container } = renderProfileForm();

    const nickInput = screen.getByLabelText(
      koMessages.profile.form.nicknameLabel,
    ) as HTMLInputElement;
    fireEvent.change(nickInput, { target: { value: "talkpik-race" } });
    await waitFor(() => {
      expect(screen.getByText(koMessages.profile.form.nicknameAvailable)).toBeTruthy();
    });

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(koMessages.profile.form.nicknameTaken).length,
      ).toBeGreaterThan(0);
    });
  });

  it("renders existing bio value from initialProfile", () => {
    const existing = "TOPIK 시험을 6개월 준비 중이에요.";
    renderProfileForm({
      initialProfile: {
        display_name: null,
        nickname: null,
        bio: existing,
      },
    });

    const bioInput = screen.getByLabelText("자기소개") as HTMLTextAreaElement;
    expect(bioInput.value).toBe(existing);
  });

  it("renders account identity and a real avatar upload area", () => {
    renderProfileForm({ accountEmail: "learner@example.com" });

    const emailInput = screen.getByLabelText("이메일") as HTMLInputElement;
    expect(emailInput.value).toBe("learner@example.com");
    expect(emailInput.readOnly).toBe(true);
    expect(screen.getByText("프로필 이미지")).toBeTruthy();
    // X-05: avatar upload is now a real Supabase Storage upload (owner-scoped),
    // replacing the earlier "deferred" honest-notice. The upload affordance and
    // its constraints (JPG/PNG, 5MB, square crop) must be shown.
    expect(
      screen.getByText(/JPG 또는 PNG, 5MB 이하/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("이미지 업로드"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("프로필 이미지 파일 선택"),
    ).toBeTruthy();
    // The account-identity / PII re-auth notice remains.
    expect(
      screen.getByText(/계정 식별 정보 변경은 향후 재인증이 필요할 수 있습니다/),
    ).toBeTruthy();
    expect(
      screen.getByText(/이름·닉네임·자기소개 변경은 바로 저장됩니다/),
    ).toBeTruthy();
  });

  it("enables Save only after a dirty edit and protects browser leave", () => {
    renderProfileForm({
      initialProfile: { display_name: "Chan", nickname: "chan-k", bio: null },
    });

    const saveButton = screen.getByRole("button", { name: "프로필 저장" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Chan Kim" } });

    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("asks before internal navigation while profile edits are dirty", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderProfileFormWithNavigation({
      initialProfile: { display_name: "Chan", nickname: "chan-k", bio: null },
    });

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Chan Kim" } });

    const link = screen.getByRole("link", { name: "대시보드로 이동" });
    expect(fireEvent.click(link)).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith(
      "저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠어요?",
    );

    confirmSpy.mockRestore();
  });
});
