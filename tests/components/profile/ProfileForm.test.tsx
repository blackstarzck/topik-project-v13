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
import type { ReactNode } from "react";

const mutateAsyncMock = vi.fn();
const useUpdateProfileMock = vi.fn();

vi.mock("@/lib/settings/mutations", () => ({
  useUpdateProfile: (...args: unknown[]) => useUpdateProfileMock(...args),
}));

import {
  ProfileForm,
  normalizeProfileField,
} from "../../../src/components/profile/ProfileForm";

function renderInApp(node: ReactNode) {
  return render(<AntdApp>{node}</AntdApp>);
}

beforeEach(() => {
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue(undefined);
  useUpdateProfileMock.mockReset();
  useUpdateProfileMock.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: mutateAsyncMock,
    isPending: false,
  });

  // Phase 7-E Task 10: bio TextArea uses Ant Design which expects ResizeObserver.
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
  it("submits null for both fields when initial values are blank and user does not type", async () => {
    const { container } = renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: null, nickname: null, bio: null }}
      />,
    );

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(useUpdateProfileMock).toHaveBeenCalledWith("user-1");
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      display_name: null,
      nickname: null,
      bio: null,
    });
  });

  it("submits null when the user clears an existing value to empty string", async () => {
    const { container } = renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: "Chan", nickname: "chan-k", bio: null }}
      />,
    );

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

  it("submits trimmed values for both fields", async () => {
    const { container } = renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: null, nickname: null, bio: null }}
      />,
    );

    const nameInput = screen.getByLabelText("이름") as HTMLInputElement;
    const nickInput = screen.getByLabelText("닉네임") as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "  Chan  " } });
    fireEvent.change(nickInput, { target: { value: "tester" } });

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

  // Phase 7-E Task 10 (P1-6) — bio input + maxLength enforcement.

  it("submits bio (trimmed) when user types into the bio textarea", async () => {
    const { container } = renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: null, nickname: null, bio: null }}
      />,
    );

    const bioInput = screen.getByLabelText("자기소개") as HTMLTextAreaElement;
    fireEvent.change(bioInput, {
      target: { value: "  TOPIK II 4급 목표  " },
    });

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        display_name: null,
        nickname: null,
        bio: "TOPIK II 4급 목표",
      });
    });
  });

  it("bio textarea enforces 160-char maxLength via the DOM attribute", () => {
    renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: null, nickname: null, bio: null }}
      />,
    );

    const bioInput = screen.getByLabelText("자기소개") as HTMLTextAreaElement;
    // Ant Design Input.TextArea propagates `maxLength` to the underlying
    // textarea. We assert the attribute rather than try to type 161 chars
    // (jsdom would not block input even if maxLength existed).
    expect(bioInput.maxLength).toBe(160);
  });

  it("renders existing bio value from initialProfile", () => {
    const existing = "TOPIK 시험을 6개월 준비 중이에요.";
    renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{
          display_name: null,
          nickname: null,
          bio: existing,
        }}
      />,
    );
    const bioInput = screen.getByLabelText("자기소개") as HTMLTextAreaElement;
    expect(bioInput.value).toBe(existing);
  });
});
