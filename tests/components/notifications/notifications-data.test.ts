import { describe, expect, it } from "vitest";

import {
  mapInstitutionInvitationError,
  resolveInstitutionInvitationStatus,
  resolveNotificationAction,
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

  it("accepts an institution invite link with aff and next query params", () => {
    expect(
      resolveNotificationDestination({
        ...baseNotification,
        link_url:
          "/auth/institution-invite?aff=EXPO2026-BOOTH-A&next=/settings/account",
        payload: {
          affiliation_code: "EXPO2026-BOOTH-A",
          kind: "institution_invite",
        },
      }),
    ).toBe(
      "/auth/institution-invite?aff=EXPO2026-BOOTH-A&next=/settings/account",
    );
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

describe("resolveNotificationAction", () => {
  it("opens the institution invitation modal before any route destination", () => {
    expect(
      resolveNotificationAction({
        ...baseNotification,
        template_key: "institution_invitation",
        route_path: "/dashboard",
        link_url: "/auth/institution-invite?aff=LEGACY",
        payload: {
          kind: "institution_invitation",
          invitation_id: "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
          code: "CAMPAIGN-01",
          code_label: "캠페인 유입 유저",
        },
      }),
    ).toEqual({
      kind: "institutionInvitation",
      invitation: {
        invitationId: "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        code: "CAMPAIGN-01",
        codeLabel: "캠페인 유입 유저",
      },
    });
  });

  it("keeps the legacy institution invite link as a route action", () => {
    expect(
      resolveNotificationAction({
        ...baseNotification,
        link_url:
          "/auth/institution-invite?aff=EXPO2026-BOOTH-A&next=/settings/account",
        payload: {
          affiliation_code: "EXPO2026-BOOTH-A",
          kind: "institution_invite",
        },
      }),
    ).toEqual({
      kind: "route",
      href: "/auth/institution-invite?aff=EXPO2026-BOOTH-A&next=/settings/account",
    });
  });

  it("returns an invalid institution invitation action when the id is missing", () => {
    expect(
      resolveNotificationAction({
        ...baseNotification,
        template_key: "institution_invitation",
        payload: {
          kind: "institution_invitation",
          code: "CAMPAIGN-01",
          code_label: "캠페인 유입 유저",
        },
      }),
    ).toEqual({
      kind: "institutionInvitation",
      invitation: {
        invitationId: null,
        code: "CAMPAIGN-01",
        codeLabel: "캠페인 유입 유저",
      },
    });
  });
});

describe("mapInstitutionInvitationError", () => {
  it("maps known RPC messages without exposing raw database errors", () => {
    expect(
      mapInstitutionInvitationError(
        new Error("invitation already responded: accepted"),
      ),
    ).toBe("alreadyResponded");
    expect(
      mapInstitutionInvitationError(
        new Error("invitation already responded: canceled"),
      ),
    ).toBe("withdrawn");
    expect(mapInstitutionInvitationError(new Error("code_inactive"))).toBe(
      "expired",
    );
    expect(
      mapInstitutionInvitationError(new Error("invitation canceled by admin")),
    ).toBe("withdrawn");
    expect(mapInstitutionInvitationError(new Error("unauthenticated"))).toBe(
      "unauthenticated",
    );
    expect(
      mapInstitutionInvitationError(
        new Error("forbidden: not invitation owner"),
      ),
    ).toBe("failed");
  });
});

describe("resolveInstitutionInvitationStatus", () => {
  it("splits canceled RPC results into expired or withdrawn user states", () => {
    expect(
      resolveInstitutionInvitationStatus({
        status: "canceled",
        error: "code_inactive",
      }),
    ).toBe("expired");
    expect(
      resolveInstitutionInvitationStatus({
        status: "canceled",
      }),
    ).toBe("withdrawn");
  });
});
