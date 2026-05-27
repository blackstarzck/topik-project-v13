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
const useUpdateLocaleMock = vi.fn();

vi.mock("@/lib/settings/mutations", () => ({
  useUpdateLocale: (...args: unknown[]) => useUpdateLocaleMock(...args),
}));

import { LanguageForm } from "../../../src/components/settings/LanguageForm";

function renderInApp(node: ReactNode) {
  return render(<AntdApp>{node}</AntdApp>);
}

beforeEach(() => {
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue(undefined);
  useUpdateLocaleMock.mockReset();
  useUpdateLocaleMock.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: mutateAsyncMock,
    isPending: false,
  });

  // antd internals query matchMedia in jsdom.
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

function submitForm(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("form element not found");
  // antd Form's onFinish runs on the <form>'s submit event. Click on the
  // submit button does not always propagate cleanly under jsdom + RC Form,
  // so we dispatch the event directly on the form element.
  fireEvent.submit(form);
}

describe("LanguageForm", () => {
  it("submits the initial locale unchanged when the user does not interact", async () => {
    const { container } = renderInApp(
      <LanguageForm userId="user-1" initialLocale="ko" />,
    );

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(useUpdateLocaleMock).toHaveBeenCalledWith("user-1");
    expect(mutateAsyncMock).toHaveBeenCalledWith({ locale: "ko" });
  });

  it("submits the selected locale after a radio change", async () => {
    const { container } = renderInApp(
      <LanguageForm userId="user-1" initialLocale="ko" />,
    );

    // Pick the English radio.
    const englishRadio = screen.getByLabelText("English") as HTMLInputElement;
    fireEvent.click(englishRadio);

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsyncMock).toHaveBeenCalledWith({ locale: "en" });
  });

  it("supports selecting Vietnamese", async () => {
    const { container } = renderInApp(
      <LanguageForm userId="user-2" initialLocale="ko" />,
    );

    fireEvent.click(screen.getByLabelText("Tiếng Việt"));
    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({ locale: "vi" });
    });
    expect(useUpdateLocaleMock).toHaveBeenCalledWith("user-2");
  });
});
