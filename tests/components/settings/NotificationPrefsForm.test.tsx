// @vitest-environment jsdom
import { readFileSync } from "node:fs";

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

const mutateAsyncMock = vi.fn();
const useUpdateNotificationPrefsMock = vi.fn();

vi.mock("@/lib/settings/mutations", () => ({
  useUpdateNotificationPrefs: (...args: unknown[]) =>
    useUpdateNotificationPrefsMock(...args),
}));

import {
  NotificationPrefsForm,
  computeNotificationDiff,
} from "../../../src/components/settings/NotificationPrefsForm";

// NotificationPrefsForm now uses next-intl's useTranslations, so it must render
// inside a NextIntlClientProvider. We supply the baseline (ko) catalog — the
// same Korean strings the assertions below match (e.g. the deferred-delivery
// notice and the switch aria-labels). The settings.notifications.* catalog is
// merged into messages/ko.json by the coordinator before commit.
function renderInApp(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{node}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue(undefined);
  useUpdateNotificationPrefsMock.mockReset();
  useUpdateNotificationPrefsMock.mockReturnValue({
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

describe("computeNotificationDiff (pure helper)", () => {
  it("returns empty object when nothing changed", () => {
    expect(
      computeNotificationDiff(
        { weekly_summary: true, feedback_ready: false, study_reminder: true },
        { weekly_summary: true, feedback_ready: false, study_reminder: true },
      ),
    ).toEqual({});
  });

  it("treats missing initial keys as false", () => {
    expect(computeNotificationDiff({ weekly_summary: false }, {})).toEqual({});
    expect(computeNotificationDiff({ weekly_summary: true }, {})).toEqual({
      weekly_summary: true,
    });
  });

  it("only includes flipped keys", () => {
    expect(
      computeNotificationDiff(
        { weekly_summary: true, feedback_ready: true, study_reminder: false },
        { weekly_summary: true, feedback_ready: false, study_reminder: false },
      ),
    ).toEqual({ feedback_ready: true });
  });
});

function submitForm(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("form element not found");
  fireEvent.submit(form);
}

describe("NotificationPrefsForm", () => {
  it("defines notification description text styles at 14px", () => {
    const css = readFileSync("src/styles/global.css", "utf8").replace(
      /\s+/g,
      " ",
    );

    expect(css).toContain(
      ".notification-settings-section-description.ant-typography, .notification-settings-row-hint.ant-typography, .notification-settings-type-description.ant-typography, .notification-settings-channel-copy .ant-typography-secondary.ant-typography, .notification-settings-redesign .ant-alert .ant-alert-description, .notification-settings-detail-panel > section > .ant-typography-secondary.ant-typography {",
    );
    expect(css).toMatch(
      /\.notification-settings-section-description\.ant-typography, .*?font-size: 14px;/,
    );
  });

  it("submits an empty diff when the user submits without toggling anything", async () => {
    const { container } = renderInApp(
      <NotificationPrefsForm
        userId="user-1"
        initialPrefs={{ weekly_summary: true }}
      />,
    );

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(useUpdateNotificationPrefsMock).toHaveBeenCalledWith("user-1");
    expect(mutateAsyncMock).toHaveBeenCalledWith({});
  });

  it("submits only the toggled keys as a tight diff payload", async () => {
    const { container } = renderInApp(
      <NotificationPrefsForm
        userId="user-1"
        initialPrefs={{ weekly_summary: true, feedback_ready: false }}
      />,
    );

    // Toggle the feedback_ready switch to true (delta vs initial=false).
    const feedbackSwitch = screen.getByRole("switch", {
      name: "피드백 준비 완료 알림",
    });
    fireEvent.click(feedbackSwitch);

    await act(async () => {
      submitForm(container);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsyncMock).toHaveBeenCalledWith({ feedback_ready: true });
  });

  it("renders the OOS-9 informational alert", () => {
    renderInApp(<NotificationPrefsForm userId="user-1" initialPrefs={{}} />);
    // X-09: transport is still deferred — only the receive channels/conditions/
    // time are persisted; actual delivery is not wired. Copy updated by the
    // X-09 build to reflect the richer settings (channels + schedule + log).
    expect(
      screen.getByText(
        "실제 알림 발송 연동은 준비 중입니다. 지금은 수신 채널·조건·시간이 저장되며, 발송 이력은 발송이 시작되면 채워집니다.",
      ),
    ).toBeTruthy();
  });

  it("renders the learning-routine redesign while preserving notification controls", async () => {
    const { container } = renderInApp(
      <NotificationPrefsForm userId="user-1" initialPrefs={{}} />,
    );

    expect(screen.getByTestId("notification-redesign-shell")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByTestId("notification-routine-row-frequency"),
      ).toBeTruthy();
    });
    expect(screen.getByTestId("notification-type-feedback_ready")).toBeTruthy();
    expect(screen.getByTestId("notification-channel-in_app")).toBeTruthy();
    expect(screen.queryByTestId("notification-preview-card")).toBeNull();
    expect(screen.queryByTestId("notification-history-card")).toBeNull();
    expect(screen.getByTestId("notification-details-toggle")).toBeTruthy();
    expect(screen.queryByText("도움말")).toBeNull();
    expect(
      screen.getByRole("switch", { name: "피드백 준비 완료 알림" }),
    ).toBeTruthy();
    expect(
      (screen.getByTestId("notification-save") as HTMLButtonElement).disabled,
    ).toBe(true);

    expect(
      container.querySelectorAll(".notification-settings-row-label svg"),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(".notification-settings-type-copy svg"),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(".notification-settings-channel-copy svg"),
    ).toHaveLength(3);

    fireEvent.click(screen.getByTestId("notification-details-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("notification-preview-card")).toBeTruthy();
    });
    expect(
      container.querySelectorAll(".notification-settings-detail-title svg"),
    ).toHaveLength(0);
  });
});
