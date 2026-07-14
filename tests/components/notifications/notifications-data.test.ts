import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mapInstitutionInvitationError,
  resolveInstitutionInvitationExpiry,
  resolveInstitutionInvitationStatus,
  respondInstitutionInvitation,
  resolveNotificationAction,
  resolveNotificationDestination,
  type UserNotification,
} from "../../../src/components/notifications/notifications-data";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    rpc: rpcMock,
  }),
}));

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

beforeEach(() => {
  rpcMock.mockReset();
});

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
        expiresAt: null,
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
        expiresAt: null,
        codeLabel: "캠페인 유입 유저",
      },
    });
  });
});

describe("resolveInstitutionInvitationExpiry", () => {
  const now = new Date("2026-07-13T15:00:00.000Z");

  it("returns the Seoul calendar-day difference for a future expiry", () => {
    expect(
      resolveInstitutionInvitationExpiry("2026-07-15T14:59:59.000Z", now),
    ).toEqual({ status: "active", daysRemaining: 1 });
  });

  it("returns D-0 while the invitation expires later on the same Seoul date", () => {
    expect(
      resolveInstitutionInvitationExpiry("2026-07-14T14:59:59.000Z", now),
    ).toEqual({ status: "active", daysRemaining: 0 });
  });

  it("returns expired at the exact expiry instant", () => {
    expect(
      resolveInstitutionInvitationExpiry("2026-07-13T15:00:00.000Z", now),
    ).toEqual({ status: "expired" });
  });

  it.each([
    null,
    "",
    "not-a-date",
    "2026-07-14",
    "2026-07-14T14:59:59",
    "2026-02-30T00:00:00Z",
    "2026-04-31T00:00:00+00:00",
  ])(
    "does not infer a state for a missing or invalid expiry (%s)",
    (expiresAt) => {
      expect(resolveInstitutionInvitationExpiry(expiresAt, now)).toEqual({
        status: "unknown",
      });
    },
  );
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
    expect(
      mapInstitutionInvitationError(
        new Error("already affiliated with another institution"),
      ),
    ).toBe("alreadyAffiliatedOther");
    expect(mapInstitutionInvitationError(new Error("profile_not_found"))).toBe(
      "invalid",
    );
  });
});

describe("respondInstitutionInvitation", () => {
  it("accepts an invitation through the institution invitation response RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        status: "accepted",
        code: "CAMPAIGN-01",
        code_label: "Campaign",
      },
      error: null,
    });

    await expect(
      respondInstitutionInvitation(
        "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        true,
      ),
    ).resolves.toEqual({
      status: "accepted",
      code: "CAMPAIGN-01",
      code_label: "Campaign",
    });

    expect(rpcMock).toHaveBeenCalledWith("respond_institution_invitation", {
      p_invitation_id: "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
      p_accept: true,
    });
  });

  it("preserves the shared RPC false argument for non-modal compatibility", async () => {
    rpcMock.mockResolvedValue({
      data: {
        status: "declined",
        code: "CAMPAIGN-01",
        code_label: "Campaign",
      },
      error: null,
    });

    await expect(
      respondInstitutionInvitation(
        "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        false,
      ),
    ).resolves.toEqual({
      status: "declined",
      code: "CAMPAIGN-01",
      code_label: "Campaign",
    });

    expect(rpcMock).toHaveBeenCalledWith("respond_institution_invitation", {
      p_invitation_id: "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
      p_accept: false,
    });
  });

  it("preserves the RPC expired result as the final server status", async () => {
    rpcMock.mockResolvedValue({
      data: {
        status: "expired",
        error: "invitation_expired",
        code: "CAMPAIGN-01",
        code_label: "Campaign",
      },
      error: null,
    });

    await expect(
      respondInstitutionInvitation(
        "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        true,
      ),
    ).resolves.toEqual({
      status: "expired",
      error: "invitation_expired",
      code: "CAMPAIGN-01",
      code_label: "Campaign",
    });
  });

  it("passes RPC errors through for handled modal mapping", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "already affiliated with another institution" },
    });

    await expect(
      respondInstitutionInvitation(
        "2a2ff7b8-cc31-4f4d-a455-283aaad28f30",
        true,
      ),
    ).rejects.toThrow(/already affiliated/);
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
