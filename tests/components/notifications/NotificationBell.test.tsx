// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { NotificationBell } from "../../../src/components/notifications/NotificationBell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerPushMock = vi.hoisted(() => vi.fn());
const {
  fetchNotificationsMock,
  fetchUnreadNotificationCountMock,
  markAllNotificationsReadMock,
  markNotificationReadMock,
} = vi.hoisted(() => ({
  fetchNotificationsMock: vi.fn(),
  fetchUnreadNotificationCountMock: vi.fn(),
  markAllNotificationsReadMock: vi.fn(),
  markNotificationReadMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("../../../src/components/notifications/notifications-data", () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  fetchUnreadNotificationCount: (...args: unknown[]) =>
    fetchUnreadNotificationCountMock(...args),
  markAllNotificationsRead: (...args: unknown[]) =>
    markAllNotificationsReadMock(...args),
  markNotificationRead: (...args: unknown[]) =>
    markNotificationReadMock(...args),
  resolveNotificationDestination: () => null,
}));

const t = koMessages.notifications.bell;

function makeNotification(id: string, title: string) {
  return {
    id,
    template_key: "notice",
    category: "notice",
    title,
    body: "Body",
    link_url: null,
    route_path: null,
    read_at: null,
    created_at: "2026-06-22T09:00:00.000Z",
  };
}

beforeEach(() => {
  routerPushMock.mockReset();
  fetchNotificationsMock.mockReset();
  fetchUnreadNotificationCountMock.mockReset();
  markAllNotificationsReadMock.mockReset();
  markNotificationReadMock.mockReset();
  fetchUnreadNotificationCountMock.mockResolvedValue(2);
  fetchNotificationsMock.mockResolvedValue([
    makeNotification("n-1", "First notice"),
    makeNotification("n-2", "Second notice"),
  ]);
  markNotificationReadMock.mockResolvedValue(undefined);
  markAllNotificationsReadMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("NotificationBell", () => {
  it("runs mark-all only once while the mutation is pending", async () => {
    markAllNotificationsReadMock.mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<NotificationBell userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const markAll = await screen.findByRole("button", {
      name: t.markAllRead,
    });

    fireEvent.click(markAll);
    fireEvent.click(markAll);

    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1);
    expect(markAllNotificationsReadMock).toHaveBeenCalledWith("user-1");
    await waitFor(() => {
      expect(markAll).toHaveProperty("disabled", true);
    });
  });

  it("marks the same unread notification only once while the item is pending", async () => {
    markNotificationReadMock.mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<NotificationBell userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const title = await screen.findByText("First notice");
    const rowButton = title.closest("button");
    if (!rowButton) throw new Error("notification row button not found");

    fireEvent.click(rowButton);
    fireEvent.click(rowButton);

    expect(markNotificationReadMock).toHaveBeenCalledTimes(1);
    expect(markNotificationReadMock).toHaveBeenCalledWith("n-1");
    await waitFor(() => {
      expect(rowButton).toHaveProperty("disabled", true);
    });
  });
});
