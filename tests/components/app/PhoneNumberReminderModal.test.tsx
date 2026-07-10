// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import koMessages from "../../../messages/ko.json";

const { dismissMock, pushMock } = vi.hoisted(() => ({
  dismissMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/lib/settings/mutations", () => ({
  dismissPhoneNumberPrompt: (...args: unknown[]) => dismissMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PhoneNumberReminderModal } from "../../../src/components/app/PhoneNumberReminderModal";

const reminder = koMessages.app.phoneReminder;
const LEGACY_SESSION_KEY = "talkpik.phoneReminderModalDismissed";

function sessionKey(userId: string) {
  return `${LEGACY_SESSION_KEY}:${userId}`;
}

function renderModal(
  props: Partial<Parameters<typeof PhoneNumberReminderModal>[0]> = {},
) {
  return renderWithIntl(
    <PhoneNumberReminderModal
      userId="user-1"
      phoneNumber={null}
      phoneNumberPromptDismissedAt={null}
      pathname="/dashboard"
      {...props}
    />,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  dismissMock.mockReset();
  dismissMock.mockResolvedValue(undefined);
  pushMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PhoneNumberReminderModal", () => {
  it("opens on entry to a non-excluded workspace route when phone is missing", async () => {
    renderModal({ pathname: "/dashboard" });
    expect(await screen.findByText(reminder.title)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("also opens on a direct landing to a non-dashboard route", async () => {
    renderModal({ pathname: "/library" });
    expect(await screen.findByText(reminder.title)).toBeTruthy();
  });

  it("does not open when the user already has a phone number", () => {
    renderModal({ phoneNumber: "01012345678" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open when the prompt was permanently dismissed", () => {
    renderModal({ phoneNumberPromptDismissedAt: "2026-07-09T00:00:00.000Z" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not open on the profile editor route", () => {
    renderModal({ pathname: "/profile" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    "/writing/short-answer-writing-51",
    "/writing/answer-writing-52",
    "/writing/long-form-writing-53",
    "/writing/essay-writing-54",
    "/onboarding/learning-goal",
  ])("does not interrupt the immersive route %s", (pathname) => {
    renderModal({ pathname });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays closed for the rest of the session once suppressed", () => {
    window.sessionStorage.setItem(sessionKey("user-1"), "1");
    renderModal({ pathname: "/dashboard" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("navigates to /profile and suppresses the session on the CTA", async () => {
    renderModal({ pathname: "/dashboard" });
    fireEvent.click(await screen.findByRole("button", { name: reminder.cta }));
    expect(pushMock).toHaveBeenCalledWith("/profile");
    expect(window.sessionStorage.getItem(sessionKey("user-1"))).toBe("1");
  });

  it("does not suppress a new account after another account closed the modal", async () => {
    const firstAccount = renderModal({ userId: "user-1" });
    fireEvent.click(await screen.findByRole("button", { name: reminder.cta }));
    expect(window.sessionStorage.getItem(sessionKey("user-1"))).toBe("1");
    expect(window.sessionStorage.getItem(sessionKey("user-2"))).toBeNull();
    firstAccount.unmount();

    renderModal({ userId: "user-2" });
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("ignores the legacy account-agnostic suppression key", async () => {
    window.sessionStorage.setItem(LEGACY_SESSION_KEY, "1");
    renderModal({ userId: "user-2" });
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("permanently dismisses via 'don't show again'", async () => {
    renderModal({ pathname: "/dashboard" });
    fireEvent.click(
      await screen.findByRole("button", { name: reminder.dismiss }),
    );
    await waitFor(() => {
      expect(dismissMock).toHaveBeenCalledWith("user-1");
    });
  });

  it("keeps the modal open and surfaces an error when dismiss fails", async () => {
    dismissMock.mockRejectedValue(new Error("rls denied"));
    renderModal({ pathname: "/dashboard" });
    fireEvent.click(
      await screen.findByRole("button", { name: reminder.dismiss }),
    );
    await waitFor(() => {
      expect(dismissMock).toHaveBeenCalledWith("user-1");
    });
    expect(await screen.findByText(reminder.dismissError)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
