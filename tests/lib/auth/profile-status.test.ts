import { describe, expect, it, vi } from "vitest";

import {
  fetchProfileStatus,
  getCurrentAccountState,
  isActiveStatus,
} from "../../../src/lib/auth/profile";
import type { SupabaseServerClient } from "../../../src/lib/supabase/server";

// Builds a Supabase stub whose minimal get_my_account_state RPC resolves to
// the given payload, mirroring fetchProfileStatus' fail-closed contract.
function clientReturning(payload: { data: string | null; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue(payload);
  return {
    stub: { rpc } as unknown as SupabaseServerClient,
    rpc,
  };
}

function currentAccountClient(payload: {
  user: { id: string } | null;
  state: string | null;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: payload.user },
    error: null,
  });
  const rpc = vi.fn().mockResolvedValue({ data: payload.state, error: null });
  return {
    stub: { auth: { getUser }, rpc } as unknown as SupabaseServerClient,
    getUser,
    rpc,
  };
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
    const { stub, rpc } = clientReturning({ data: "deleted" });
    await expect(fetchProfileStatus(stub, "user-1")).resolves.toBe("deleted");
    expect(rpc).toHaveBeenCalledWith("get_my_account_state");
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
    const active = clientReturning({ data: "active" });
    const blocked = clientReturning({ data: "blocked" });
    expect(isActiveStatus(await fetchProfileStatus(active.stub, "u"))).toBe(
      true,
    );
    expect(isActiveStatus(await fetchProfileStatus(blocked.stub, "u"))).toBe(
      false,
    );
  });
});

describe("getCurrentAccountState", () => {
  it("returns the authenticated user and minimal RPC status", async () => {
    const client = currentAccountClient({
      user: { id: "user-1" },
      state: "deleted",
    });

    await expect(
      getCurrentAccountState(async () => client.stub),
    ).resolves.toEqual({
      user: { id: "user-1" },
      status: "deleted",
    });
    expect(client.rpc).toHaveBeenCalledWith("get_my_account_state");
  });

  it("returns null without calling the state RPC when unauthenticated", async () => {
    const client = currentAccountClient({ user: null, state: null });

    await expect(
      getCurrentAccountState(async () => client.stub),
    ).resolves.toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
