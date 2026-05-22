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
        initialProfile={{ display_name: null, nickname: null }}
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
    });
  });

  it("submits null when the user clears an existing value to empty string", async () => {
    const { container } = renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: "Chan", nickname: "chan-k" }}
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
      });
    });
  });

  it("submits trimmed values for both fields", async () => {
    const { container } = renderInApp(
      <ProfileForm
        userId="user-1"
        initialProfile={{ display_name: null, nickname: null }}
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
      });
    });
  });
});
