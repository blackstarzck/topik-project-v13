import { describe, expect, it } from "vitest";

import {
  resolveNotificationDestination,
  type UserNotification,
} from "../../../src/components/notifications/notifications-data";

const baseNotification = {
  id: "notification-1",
  template_key: "notice",
  category: "notice",
  title: "Route notice",
  body: "Notification body",
  link_url: null,
  read_at: null,
  created_at: "2026-06-22T09:00:00.000Z",
} satisfies UserNotification;

describe("resolveNotificationDestination", () => {
  it("uses the notification route path before the legacy link url", () => {
    expect(
      resolveNotificationDestination({
        ...baseNotification,
        route_path: " /practice/problems ",
        link_url: "/dashboard",
      }),
    ).toBe("/practice/problems");
  });

  it("keeps the legacy link url as a fallback while older rows remain", () => {
    expect(
      resolveNotificationDestination({
        ...baseNotification,
        link_url: "/dashboard?from=notification",
      }),
    ).toBe("/dashboard?from=notification");
  });

  it("does not resolve an empty or external destination", () => {
    expect(
      resolveNotificationDestination({
        ...baseNotification,
        route_path: "   ",
        link_url: null,
      }),
    ).toBeNull();
    expect(
      resolveNotificationDestination({
        ...baseNotification,
        route_path: "https://example.com",
        link_url: null,
      }),
    ).toBeNull();
  });
});
