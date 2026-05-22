import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  requirePlatformAdminMock: vi.fn(),
  requireContentAdminMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  requirePlatformAdmin: () => helpers.requirePlatformAdminMock(),
  requireContentAdmin: () => helpers.requireContentAdminMock(),
  requireOrgAdmin: () => Promise.resolve(null),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      rpc: (...args: unknown[]) => helpers.rpcMock(...args),
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  helpers.requirePlatformAdminMock.mockResolvedValue({
    id: "admin-1",
    app_role: "platform_admin",
  });
  helpers.requireContentAdminMock.mockResolvedValue({
    id: "admin-2",
    app_role: "content_admin",
  });
  helpers.rpcMock.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("changeUserRoleAction", () => {
  it("calls admin_change_user_role RPC with snake_case args and returns ok", async () => {
    const { changeUserRoleAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    const result = await changeUserRoleAction({
      targetId: "user-target",
      newRole: "content_admin",
    });
    expect(helpers.requirePlatformAdminMock).toHaveBeenCalledTimes(1);
    expect(helpers.rpcMock).toHaveBeenCalledTimes(1);
    expect(helpers.rpcMock).toHaveBeenCalledWith("admin_change_user_role", {
      target_id: "user-target",
      new_role: "content_admin",
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects an invalid role before hitting the RPC", async () => {
    const { changeUserRoleAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    await expect(
      changeUserRoleAction({
        targetId: "user-1",
        // @ts-expect-error - testing runtime guard
        newRole: "superadmin",
      }),
    ).rejects.toThrow(/invalid role/);
    expect(helpers.rpcMock).not.toHaveBeenCalled();
  });

  it("rejects when targetId is empty", async () => {
    const { changeUserRoleAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    await expect(
      changeUserRoleAction({ targetId: "", newRole: "learner" }),
    ).rejects.toThrow(/targetId required/);
    expect(helpers.rpcMock).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns an error", async () => {
    helpers.rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "forbidden: platform_admin required" },
    });
    const { changeUserRoleAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    await expect(
      changeUserRoleAction({
        targetId: "user-target",
        newRole: "learner",
      }),
    ).rejects.toThrow(/forbidden/);
  });
});

describe("togglePublishAction", () => {
  it("calls admin_toggle_problem_publish RPC with snake_case args and returns ok", async () => {
    const { togglePublishAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    const result = await togglePublishAction({
      problemId: "problem-1",
      newStatus: "published",
    });
    expect(helpers.requireContentAdminMock).toHaveBeenCalledTimes(1);
    expect(helpers.rpcMock).toHaveBeenCalledTimes(1);
    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "admin_toggle_problem_publish",
      { problem_id: "problem-1", new_status: "published" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects an invalid status before hitting the RPC", async () => {
    const { togglePublishAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    await expect(
      togglePublishAction({
        problemId: "problem-1",
        // @ts-expect-error - testing runtime guard
        newStatus: "hidden",
      }),
    ).rejects.toThrow(/invalid status/);
    expect(helpers.rpcMock).not.toHaveBeenCalled();
  });

  it("rejects when problemId is empty", async () => {
    const { togglePublishAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    await expect(
      togglePublishAction({ problemId: "", newStatus: "draft" }),
    ).rejects.toThrow(/problemId required/);
    expect(helpers.rpcMock).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns an error", async () => {
    helpers.rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "problem not found" },
    });
    const { togglePublishAction } = await import(
      "../../../src/lib/admin/server-actions"
    );
    await expect(
      togglePublishAction({
        problemId: "missing",
        newStatus: "archived",
      }),
    ).rejects.toThrow(/problem not found/);
  });
});
