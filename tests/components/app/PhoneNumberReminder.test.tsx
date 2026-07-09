// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import koMessages from "../../../messages/ko.json";

const { dismissMock } = vi.hoisted(() => ({ dismissMock: vi.fn() }));

vi.mock("@/lib/settings/mutations", () => ({
  dismissPhoneNumberPrompt: (...args: unknown[]) => dismissMock(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

import { PhoneNumberReminder } from "../../../src/components/app/PhoneNumberReminder";

const reminder = koMessages.app.phoneReminder;

function renderReminder(
  props: Partial<Parameters<typeof PhoneNumberReminder>[0]> = {},
) {
  return renderWithIntl(
    <PhoneNumberReminder
      userId="user-1"
      phoneNumber={null}
      phoneNumberPromptDismissedAt={null}
      pathname="/dashboard"
      {...props}
    />,
  );
}

beforeEach(() => {
  dismissMock.mockReset();
  dismissMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("PhoneNumberReminder", () => {
  it("shows the banner when phone is missing, not dismissed, and off /profile", () => {
    renderReminder();

    expect(screen.getByTestId("phone-number-reminder")).toBeTruthy();
    expect(screen.getByText(reminder.title)).toBeTruthy();
    const cta = screen.getByRole("link", { name: reminder.cta });
    expect(cta.getAttribute("href")).toBe("/profile");
  });

  it("hides when the user already has a phone number", () => {
    renderReminder({ phoneNumber: "01012345678" });
    expect(screen.queryByTestId("phone-number-reminder")).toBeNull();
  });

  it("hides when the prompt was already dismissed", () => {
    renderReminder({
      phoneNumberPromptDismissedAt: "2026-07-09T00:00:00.000Z",
    });
    expect(screen.queryByTestId("phone-number-reminder")).toBeNull();
  });

  it("hides on the /profile route", () => {
    renderReminder({ pathname: "/profile" });
    expect(screen.queryByTestId("phone-number-reminder")).toBeNull();
  });

  it("dismisses permanently and hides on success", async () => {
    renderReminder();

    fireEvent.click(screen.getByRole("button", { name: reminder.dismiss }));

    await waitFor(() => {
      expect(dismissMock).toHaveBeenCalledWith("user-1");
    });
    await waitFor(() => {
      expect(screen.queryByTestId("phone-number-reminder")).toBeNull();
    });
  });

  it("keeps the banner and surfaces an error when dismiss fails", async () => {
    dismissMock.mockRejectedValue(new Error("rls denied"));
    renderReminder();

    fireEvent.click(screen.getByRole("button", { name: reminder.dismiss }));

    await waitFor(() => {
      expect(dismissMock).toHaveBeenCalledWith("user-1");
    });
    expect(await screen.findByText(reminder.dismissError)).toBeTruthy();
    expect(screen.getByTestId("phone-number-reminder")).toBeTruthy();
  });
});
