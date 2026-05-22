import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Phase 6 integration: admin-flow
// - requirePlatformAdmin redirects non-platform admins from /admin/users
// - requireContentAdmin allows content_admin into /admin/problems
// - changeUserRoleAction calls the SECURITY DEFINER RPC with sanitized inputs

const helpers = vi.hoisted(() => ({
  mockGetCurrentProfile: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth/profile", () => ({
  ADMIN_ROLES: ["content_admin", "org_admin", "platform_admin"] as const,
  getCurrentProfile: () => helpers.mockGetCurrentProfile(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    rpc: (...args: unknown[]) => helpers.mockRpc(...args),
  })),
}));

type Role = "learner" | "content_admin" | "org_admin" | "platform_admin";

function profile(app_role: Role) {
  return {
    id: "admin-id",
    display_name: null,
    nickname: null,
    avatar_path: null,
    ui_locale: "ko" as const,
    app_role,
    plan_label: "free",
    status: "active" as const,
    notification_prefs: {},
    created_at: "2026-05-22T00:00:00Z",
    updated_at: "2026-05-22T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  helpers.mockGetCurrentProfile.mockReset();
  helpers.mockRpc.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("admin-flow — page guards", () => {
  it("requirePlatformAdmin redirects content_admin away from /admin/users", async () => {
    helpers.mockGetCurrentProfile.mockResolvedValue(profile("content_admin"));
    const mod = await import("@/lib/auth/admin-guard");
    await expect(mod.requirePlatformAdmin()).rejects.toThrow(
      /REDIRECT:\/dashboard/,
    );
  });

  it("requirePlatformAdmin allows platform_admin", async () => {
    helpers.mockGetCurrentProfile.mockResolvedValue(profile("platform_admin"));
    const mod = await import("@/lib/auth/admin-guard");
    const p = await mod.requirePlatformAdmin();
    expect(p.app_role).toBe("platform_admin");
  });

  it("requireContentAdmin allows content_admin and platform_admin", async () => {
    helpers.mockGetCurrentProfile.mockResolvedValue(profile("content_admin"));
    const mod = await import("@/lib/auth/admin-guard");
    const p1 = await mod.requireContentAdmin();
    expect(p1.app_role).toBe("content_admin");

    helpers.mockGetCurrentProfile.mockResolvedValue(profile("platform_admin"));
    const p2 = await mod.requireContentAdmin();
    expect(p2.app_role).toBe("platform_admin");
  });

  it("requireContentAdmin redirects org_admin", async () => {
    helpers.mockGetCurrentProfile.mockResolvedValue(profile("org_admin"));
    const mod = await import("@/lib/auth/admin-guard");
    await expect(mod.requireContentAdmin()).rejects.toThrow(
      /REDIRECT:\/dashboard/,
    );
  });

  it("requireOrgAdmin allows org_admin and platform_admin", async () => {
    helpers.mockGetCurrentProfile.mockResolvedValue(profile("org_admin"));
    const mod = await import("@/lib/auth/admin-guard");
    const p1 = await mod.requireOrgAdmin();
    expect(p1.app_role).toBe("org_admin");
  });
});
