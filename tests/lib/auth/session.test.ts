import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, requireUser } from "../../../src/lib/auth/session";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

function makeClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user }, error: null }),
    },
  };
}

describe("auth session helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getCurrentUser returns null when no user", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const create = async () => makeClient(null) as any;
    const user = await getCurrentUser(create);
    expect(user).toBe(null);
  });

  it("getCurrentUser returns the user object when present", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const create = async () => makeClient({ id: "user-123" }) as any;
    const user = await getCurrentUser(create);
    expect(user?.id).toBe("user-123");
  });

  it("requireUser redirects to /login when no user", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const create = async () => makeClient(null) as any;
    await expect(requireUser(create)).rejects.toThrow("REDIRECT:/login");
  });

  it("requireUser returns the user when authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const create = async () => makeClient({ id: "user-123" }) as any;
    const user = await requireUser(create);
    expect(user.id).toBe("user-123");
  });
});
