import { describe, expect, it, vi } from "vitest";

import { fetchProfileStatus, isActiveStatus } from "../../../src/lib/auth/profile";
import type { SupabaseServerClient } from "../../../src/lib/supabase/server";

// Builds a supabase stub whose profiles.select(...).eq(...).maybeSingle()
// resolves to the given payload, mirroring fetchProfileStatus' query chain.
function clientReturning(
  payload: { data: { status: string } | null; error?: unknown },
) {
  const maybeSingle = vi.fn().mockResolvedValue(payload);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { stub: { from } as unknown as SupabaseServerClient, from, select, eq };
}

describe("isActiveStatus", () => {
  it("is true only for 'active'", () => {
    expect(isActiveStatus("active")).toBe(true);
    expect(isActiveStatus("blocked")).toBe(false);
    expect(isActiveStatus("deleted")).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
    expect(isActiveStatus(undefined)).toBe(false);
  });
});

describe("fetchProfileStatus", () => {
  it("returns the row status when visible", async () => {
    const { stub, from, select, eq } = clientReturning({
      data: { status: "deleted" },
    });
    await expect(fetchProfileStatus(stub, "user-1")).resolves.toBe("deleted");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("status");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("returns null when the row is not visible (RLS/unauthenticated)", async () => {
    const { stub } = clientReturning({ data: null });
    await expect(fetchProfileStatus(stub, "ghost")).resolves.toBeNull();
  });

  it("treats query errors like null data (fail-safe to inactive)", async () => {
    const { stub } = clientReturning({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    await expect(fetchProfileStatus(stub, "any")).resolves.toBeNull();
  });

  it("composes with isActiveStatus to gate inactive accounts", async () => {
    const active = clientReturning({ data: { status: "active" } });
    const blocked = clientReturning({ data: { status: "blocked" } });
    expect(isActiveStatus(await fetchProfileStatus(active.stub, "u"))).toBe(true);
    expect(isActiveStatus(await fetchProfileStatus(blocked.stub, "u"))).toBe(
      false,
    );
  });
});
