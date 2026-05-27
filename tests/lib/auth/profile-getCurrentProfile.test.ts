import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

function makeProfile(
  app_role: "learner" | "content_admin" | "org_admin" | "platform_admin",
) {
  return {
    id: "user-1",
    display_name: null,
    nickname: null,
    avatar_path: null,
    ui_locale: "ko" as const,
    app_role,
    plan_label: "free",
    status: "active" as const,
    created_at: "2026-05-21T00:00:00Z",
    updated_at: "2026-05-21T00:00:00Z",
  };
}

function makeClient(opts: {
  user: { id: string } | null;
  profile: ReturnType<typeof makeProfile> | null;
}) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: opts.user }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: opts.profile, error: null }),
        }),
      }),
    }),
  };
}

describe("getCurrentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no auth user", async () => {
    const { getCurrentProfile } = await import("../../../src/lib/auth/profile");
    const profile = await getCurrentProfile(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async () => makeClient({ user: null, profile: null }) as any,
    );
    expect(profile).toBe(null);
  });

  it("returns the profile row when authenticated", async () => {
    const { getCurrentProfile } = await import("../../../src/lib/auth/profile");
    const profile = await getCurrentProfile(
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeClient({ user: { id: "user-1" }, profile: makeProfile("learner") }) as any,
    );
    expect(profile?.app_role).toBe("learner");
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the profile when role is allowed", async () => {
    const { requireRole } = await import("../../../src/lib/auth/profile");
    const profile = await requireRole(
      ["platform_admin"],
      async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeClient({ user: { id: "u" }, profile: makeProfile("platform_admin") }) as any,
    );
    expect(profile.app_role).toBe("platform_admin");
  });

  it("redirects to /dashboard when role is not allowed", async () => {
    const { requireRole } = await import("../../../src/lib/auth/profile");
    await expect(
      requireRole(
        ["platform_admin"],
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          makeClient({ user: { id: "u" }, profile: makeProfile("learner") }) as any,
      ),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when not authenticated", async () => {
    const { requireRole } = await import("../../../src/lib/auth/profile");
    await expect(
      requireRole(
        ["learner"],
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          makeClient({ user: null, profile: null }) as any,
      ),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });
});
