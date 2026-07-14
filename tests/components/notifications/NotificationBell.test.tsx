// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { NotificationBell } from "../../../src/components/notifications/NotificationBell";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const navigationState = vi.hoisted(() => ({
  pathname: "/dashboard",
  searchParams: new URLSearchParams(),
}));
const { messageErrorMock, messageInfoMock, messageSuccessMock } = vi.hoisted(
  () => ({
    messageErrorMock: vi.fn(),
    messageInfoMock: vi.fn(),
    messageSuccessMock: vi.fn(),
  }),
);
const {
  fetchNotificationsMock,
  fetchUnreadNotificationCountMock,
  markAllNotificationsReadMock,
  markNotificationReadMock,
  respondInstitutionInvitationMock,
} = vi.hoisted(() => ({
  fetchNotificationsMock: vi.fn(),
  fetchUnreadNotificationCountMock: vi.fn(),
  markAllNotificationsReadMock: vi.fn(),
  markNotificationReadMock: vi.fn(),
  respondInstitutionInvitationMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
    refresh: routerRefreshMock,
  }),
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams,
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    App: Object.assign(actual.App, {
      useApp: () => ({
        message: {
          error: messageErrorMock,
          info: messageInfoMock,
          success: messageSuccessMock,
        },
      }),
    }),
  };
});

vi.mock("../../../src/components/notifications/notifications-data", () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  fetchUnreadNotificationCount: (...args: unknown[]) =>
    fetchUnreadNotificationCountMock(...args),
  markAllNotificationsRead: (...args: unknown[]) =>
    markAllNotificationsReadMock(...args),
  markNotificationRead: (...args: unknown[]) =>
    markNotificationReadMock(...args),
  mapInstitutionInvitationError: (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already responded: canceled")) return "withdrawn";
    if (message.includes("already responded")) return "alreadyResponded";
    if (message.includes("code_inactive")) return "expired";
    if (message.includes("canceled")) return "withdrawn";
    if (message.includes("unauthenticated")) return "unauthenticated";
    return "failed";
  },
  resolveInstitutionInvitationStatus: (result: {
    status: string;
    error?: string | null;
  }) => {
    if (result.status === "canceled") {
      return result.error === "code_inactive" ? "expired" : "withdrawn";
    }
    return result.status;
  },
  resolveInstitutionInvitationExpiry: (
    expiresAt: string | null | undefined,
    now: Date,
  ) => {
    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (!expiry || !Number.isFinite(expiry.getTime())) {
      return { status: "unknown" };
    }
    if (expiry.getTime() <= now.getTime()) return { status: "expired" };
    const calendarDay = (value: Date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(value);
      const year = Number(parts.find((part) => part.type === "year")?.value);
      const month = Number(parts.find((part) => part.type === "month")?.value);
      const day = Number(parts.find((part) => part.type === "day")?.value);
      return Date.UTC(year, month - 1, day);
    };
    return {
      status: "active",
      daysRemaining: Math.round(
        (calendarDay(expiry) - calendarDay(now)) / 86_400_000,
      ),
    };
  },
  resolveNotificationAction: (item: {
    template_key?: string;
    route_path?: string | null;
    link_url?: string | null;
    payload?: Record<string, unknown> | null;
  }) => {
    if (
      item.template_key === "institution_invitation" ||
      item.payload?.kind === "institution_invitation"
    ) {
      return {
        kind: "institutionInvitation",
        invitation: {
          invitationId:
            typeof item.payload?.invitation_id === "string"
              ? item.payload.invitation_id
              : null,
          code:
            typeof item.payload?.code === "string" ? item.payload.code : null,
          codeLabel:
            typeof item.payload?.code_label === "string"
              ? item.payload.code_label
              : null,
          expiresAt:
            typeof item.payload?.expires_at === "string"
              ? item.payload.expires_at
              : null,
        },
      };
    }
    const destination = item.route_path?.trim() || item.link_url?.trim();
    return destination?.startsWith("/")
      ? { kind: "route", href: destination }
      : { kind: "none" };
  },
  resolveNotificationDestination: () => null,
  respondInstitutionInvitation: (...args: unknown[]) =>
    respondInstitutionInvitationMock(...args),
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

function makeInstitutionInvitationNotification(
  overrides: Partial<ReturnType<typeof makeNotification>> & {
    payload?: Record<string, unknown> | null;
  } = {},
) {
  const { payload: payloadOverride, ...notificationOverrides } = overrides;

  return {
    ...makeNotification("n-invite", "기관 소속 초대가 도착했습니다"),
    template_key: "institution_invitation",
    payload: {
      kind: "institution_invitation",
      invitation_id: "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
      code: "CAMPAIGN-01",
      code_label: "캠페인 유입 유저",
    },
    ...(payloadOverride
      ? {
          payload: {
            kind: "institution_invitation",
            invitation_id: "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
            code: "CAMPAIGN-01",
            code_label: "罹좏럹???좎엯 ?좎?",
            ...payloadOverride,
          },
        }
      : undefined),
    ...(payloadOverride && typeof payloadOverride.expires_at !== "string"
      ? { payload: payloadOverride }
      : undefined),
    ...notificationOverrides,
  };
}

beforeEach(() => {
  routerPushMock.mockReset();
  routerRefreshMock.mockReset();
  routerReplaceMock.mockReset();
  navigationState.pathname = "/dashboard";
  navigationState.searchParams = new URLSearchParams();
  messageErrorMock.mockReset();
  messageInfoMock.mockReset();
  messageSuccessMock.mockReset();
  fetchNotificationsMock.mockReset();
  fetchUnreadNotificationCountMock.mockReset();
  markAllNotificationsReadMock.mockReset();
  markNotificationReadMock.mockReset();
  respondInstitutionInvitationMock.mockReset();
  fetchUnreadNotificationCountMock.mockResolvedValue(2);
  fetchNotificationsMock.mockResolvedValue([
    makeNotification("n-1", "First notice"),
    makeNotification("n-2", "Second notice"),
  ]);
  markNotificationReadMock.mockResolvedValue(undefined);
  markAllNotificationsReadMock.mockResolvedValue(undefined);
  respondInstitutionInvitationMock.mockResolvedValue({
    status: "accepted",
    code: "CAMPAIGN-01",
    code_label: "캠페인 유입 유저",
    prev_code: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("NotificationBell", () => {
  it("opens the inbox from the email CTA query and removes only that query", async () => {
    navigationState.pathname = "/settings/notifications";
    navigationState.searchParams = new URLSearchParams(
      "openNotifications=1&tab=email",
    );
    fetchNotificationsMock.mockResolvedValue([
      makeNotification("n-1", "First notice"),
    ]);

    renderWithIntl(<NotificationBell userId="user-1" />);

    expect(await screen.findByText("First notice")).toBeTruthy();
    await waitFor(() => {
      expect(fetchNotificationsMock).toHaveBeenCalledWith("user-1", 20);
    });
    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/settings/notifications?tab=email",
      { scroll: false },
    );
  });

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

  it("opens an institution invitation modal without routing and warns before replacing another affiliation", async () => {
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification(),
    ]);
    renderWithIntl(
      <NotificationBell userId="user-1" affiliationCode="OTHER-CODE" />,
    );

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const title = await screen.findByText("기관 소속 초대가 도착했습니다");
    const rowButton = title.closest("button");
    if (!rowButton) throw new Error("notification row button not found");

    fireEvent.click(rowButton);

    expect(markNotificationReadMock).toHaveBeenCalledWith("n-invite");
    expect(routerPushMock).not.toHaveBeenCalled();
    expect(await screen.findByText("캠페인 유입 유저")).toBeTruthy();
    expect(screen.getByText("CAMPAIGN-01")).toBeTruthy();
    expect(screen.getByText(/기존 소속이 변경됩니다/)).toBeTruthy();
  });

  it("shows the institution invitation D-day in the notification list", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-13T15:00:00.000Z"));
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification({
        payload: { expires_at: "2026-07-15T14:59:59.000Z" },
      }),
    ]);

    renderWithIntl(<NotificationBell userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));

    const expiryLabel = await screen.findByText("D-1");
    const metadata = expiryLabel.parentElement;
    expect(metadata?.classList.contains("app-notification-item__meta")).toBe(
      true,
    );
    expect(metadata?.querySelector(".app-notification-item__time")).not.toBe(
      null,
    );
    expect(
      metadata?.querySelector(".app-notification-item__separator")?.textContent,
    ).toBe("·");
    const rowButton = screen.getByRole("listitem").querySelector("button");
    if (!rowButton) throw new Error("notification row button not found");
    fireEvent.click(rowButton);
    expect(await screen.findByText(/만료일:/)).toBeTruthy();
    vi.useRealTimers();
  });

  it("shows an expired state in the list and modal and disables acceptance", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-13T15:00:00.000Z"));
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification({
        payload: { expires_at: "2026-07-13T14:59:59.000Z" },
      }),
    ]);

    renderWithIntl(<NotificationBell userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));

    expect(
      await screen.findByText(
        koMessages.notifications.institutionInvitation.expiredLabel,
      ),
    ).toBeTruthy();

    const rowButton = screen.getByRole("listitem").querySelector("button");
    if (!rowButton) throw new Error("notification row button not found");
    fireEvent.click(rowButton);

    expect(
      await screen.findByText(
        koMessages.notifications.institutionInvitation.expired,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: koMessages.notifications.institutionInvitation.accept,
      }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", {
        name: koMessages.notifications.institutionInvitation.close,
      }),
    ).toHaveProperty("disabled", false);
    vi.useRealTimers();
  });

  it("submits an accepted invitation and refreshes the workspace state", async () => {
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification(),
    ]);
    renderWithIntl(<NotificationBell userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const title = await screen.findByText("기관 소속 초대가 도착했습니다");
    const rowButton = title.closest("button");
    if (!rowButton) throw new Error("notification row button not found");
    fireEvent.click(rowButton);

    fireEvent.click(await screen.findByRole("button", { name: "수락" }));

    await waitFor(() => {
      expect(respondInstitutionInvitationMock).toHaveBeenCalledWith(
        "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        true,
      );
    });
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    expect(messageSuccessMock).toHaveBeenCalledWith(
      koMessages.notifications.institutionInvitation.accepted,
    );
  });

  it("submits a declined invitation without refreshing profile state", async () => {
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification(),
    ]);
    respondInstitutionInvitationMock.mockResolvedValue({
      status: "declined",
      code: "CAMPAIGN-01",
      code_label: "캠페인 유입 유저",
    });
    renderWithIntl(<NotificationBell userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const title = await screen.findByText("기관 소속 초대가 도착했습니다");
    const rowButton = title.closest("button");
    if (!rowButton) throw new Error("notification row button not found");
    fireEvent.click(rowButton);

    fireEvent.click(await screen.findByRole("button", { name: "거부" }));

    await waitFor(() => {
      expect(respondInstitutionInvitationMock).toHaveBeenCalledWith(
        "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        false,
      );
    });
    expect(routerRefreshMock).not.toHaveBeenCalled();
    expect(messageInfoMock).toHaveBeenCalledWith(
      koMessages.notifications.institutionInvitation.declined,
    );
  });

  it("disables invitation acceptance when the payload has no usable code", async () => {
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification({
        payload: {
          kind: "institution_invitation",
          code_label: "캠페인 유입 유저",
        },
      }),
    ]);
    renderWithIntl(<NotificationBell userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const title = await screen.findByText("기관 소속 초대가 도착했습니다");
    const rowButton = title.closest("button");
    if (!rowButton) throw new Error("notification row button not found");
    fireEvent.click(rowButton);

    expect(
      await screen.findByText(/초대 정보를 확인할 수 없습니다/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "수락" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "거부" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows a handled state when the invitation was already responded", async () => {
    fetchNotificationsMock.mockResolvedValue([
      makeInstitutionInvitationNotification(),
    ]);
    respondInstitutionInvitationMock.mockRejectedValue(
      new Error("invitation already responded: accepted"),
    );
    renderWithIntl(<NotificationBell userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: t.bellAria }));
    const title = await screen.findByText("기관 소속 초대가 도착했습니다");
    const rowButton = title.closest("button");
    if (!rowButton) throw new Error("notification row button not found");
    fireEvent.click(rowButton);

    fireEvent.click(await screen.findByRole("button", { name: "수락" }));

    expect(await screen.findByText(/이미 처리된 초대입니다/)).toBeTruthy();
  });
});
