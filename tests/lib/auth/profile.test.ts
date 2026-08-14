import { describe, expect, it } from "vitest";
import {
  bootstrapProfile,
  resolveProfile,
} from "../../../src/lib/auth/profile";

function makeClient(result: {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  };
}

describe("bootstrapProfile", () => {
  it("returns the existing profile row when found", async () => {
    const profile = {
      id: "user-1",
      display_name: null,
      nickname: null,
      avatar_path: null,
      ui_locale: "ko",
      app_role: "learner",
      plan_label: "free",
      status: "active",
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
    };
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ data: profile, error: null }) as any;
    const result = await bootstrapProfile("user-1", create);
    expect(result.id).toBe("user-1");
    expect(result.app_role).toBe("learner");
  });

  it("throws when the profile is missing (trigger likely failed)", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ data: null, error: null }) as any;
    await expect(bootstrapProfile("user-missing", create)).rejects.toThrow(
      /auth trigger/i,
    );
  });

  it("throws when the database returns an error", async () => {
    const create = async () =>
      makeClient({
        data: null,
        error: { message: "permission denied" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
    await expect(bootstrapProfile("user-1", create)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("resolveProfile", () => {
  it("returns a typed unavailable state for a missing profile", async () => {
    const create = async () => makeClient({ data: null, error: null }) as never;

    await expect(resolveProfile("user-missing", create)).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("does not expose database details in the unavailable result", async () => {
    const create = async () =>
      makeClient({
        data: null,
        error: { message: "permission denied SQL token=secret" },
      }) as never;

    const result = await resolveProfile("user-1", create);

    expect(result).toEqual({ status: "unavailable" });
    expect(JSON.stringify(result)).not.toMatch(/permission|SQL|secret/i);
  });
});
