import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  mockGetCurrentProfile: vi.fn(),
}));
const mockGetCurrentProfile = helpers.mockGetCurrentProfile;

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth/profile", () => ({
  ADMIN_ROLES: ["content_admin", "org_admin", "platform_admin"] as const,
  getCurrentProfile: () => helpers.mockGetCurrentProfile(),
  requireRole: async (allowed: readonly string[]) => {
    const profile = await helpers.mockGetCurrentProfile();
    if (!profile || !allowed.includes(profile.app_role)) {
      throw new Error("REDIRECT:/dashboard");
    }
    return profile;
  },
}));

type Role = "learner" | "content_admin" | "org_admin" | "platform_admin";

function makeProfile(app_role: Role) {
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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentProfile.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function callAdminLayout() {
  const mod = await import("../../src/app/(workspace)/admin/layout");
  return mod.default({ children: null as never });
}

async function callAdminIndex() {
  const mod = await import("../../src/app/(workspace)/admin/page");
  return mod.default();
}

async function callAdminProblems() {
  const mod = await import("../../src/app/(workspace)/admin/problems/page");
  return mod.default();
}

async function callAdminOrg() {
  const mod = await import("../../src/app/(workspace)/admin/org/page");
  return mod.default();
}

async function callAdminUsers() {
  const mod = await import("../../src/app/(workspace)/admin/users/page");
  return mod.default();
}

describe("admin layout — layer 1 gate (Plan Task 13 Step 2)", () => {
  it("blocks learner role", async () => {
    mockGetCurrentProfile.mockResolvedValue(makeProfile("learner"));
    await expect(callAdminLayout()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("blocks anonymous (no profile)", async () => {
    mockGetCurrentProfile.mockResolvedValue(null);
    await expect(callAdminLayout()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("allows content_admin", async () => {
    mockGetCurrentProfile.mockResolvedValue(makeProfile("content_admin"));
    await expect(callAdminLayout()).resolves.toBeTruthy();
  });

  it("allows org_admin", async () => {
    mockGetCurrentProfile.mockResolvedValue(makeProfile("org_admin"));
    await expect(callAdminLayout()).resolves.toBeTruthy();
  });

  it("allows platform_admin", async () => {
    mockGetCurrentProfile.mockResolvedValue(makeProfile("platform_admin"));
    await expect(callAdminLayout()).resolves.toBeTruthy();
  });
});

describe("admin page — layer 2 gate (route-specific requireRole)", () => {
  describe("/admin (index)", () => {
    it("allows content_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("content_admin"));
      await expect(callAdminIndex()).resolves.toBeTruthy();
    });
    it("allows org_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("org_admin"));
      await expect(callAdminIndex()).resolves.toBeTruthy();
    });
    it("allows platform_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("platform_admin"));
      await expect(callAdminIndex()).resolves.toBeTruthy();
    });
    it("blocks learner", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("learner"));
      await expect(callAdminIndex()).rejects.toThrow("REDIRECT:/dashboard");
    });
  });

  describe("/admin/problems (content_admin + platform_admin)", () => {
    it("allows content_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("content_admin"));
      await expect(callAdminProblems()).resolves.toBeTruthy();
    });
    it("allows platform_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("platform_admin"));
      await expect(callAdminProblems()).resolves.toBeTruthy();
    });
    it("blocks org_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("org_admin"));
      await expect(callAdminProblems()).rejects.toThrow("REDIRECT:/dashboard");
    });
    it("blocks learner", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("learner"));
      await expect(callAdminProblems()).rejects.toThrow("REDIRECT:/dashboard");
    });
  });

  describe("/admin/org (org_admin + platform_admin)", () => {
    it("allows org_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("org_admin"));
      await expect(callAdminOrg()).resolves.toBeTruthy();
    });
    it("allows platform_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("platform_admin"));
      await expect(callAdminOrg()).resolves.toBeTruthy();
    });
    it("blocks content_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("content_admin"));
      await expect(callAdminOrg()).rejects.toThrow("REDIRECT:/dashboard");
    });
    it("blocks learner", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("learner"));
      await expect(callAdminOrg()).rejects.toThrow("REDIRECT:/dashboard");
    });
  });

  describe("/admin/users (platform_admin only)", () => {
    it("allows platform_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("platform_admin"));
      await expect(callAdminUsers()).resolves.toBeTruthy();
    });
    it("blocks content_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("content_admin"));
      await expect(callAdminUsers()).rejects.toThrow("REDIRECT:/dashboard");
    });
    it("blocks org_admin", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("org_admin"));
      await expect(callAdminUsers()).rejects.toThrow("REDIRECT:/dashboard");
    });
    it("blocks learner", async () => {
      mockGetCurrentProfile.mockResolvedValue(makeProfile("learner"));
      await expect(callAdminUsers()).rejects.toThrow("REDIRECT:/dashboard");
    });
  });
});
