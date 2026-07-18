import { describe, expect, it, vi } from "vitest";

import {
  clearClientRecoveryForAccountDeletion,
  clearClientRecoveryForLogout,
} from "../../../src/lib/writing/client-recovery-cleanup";

describe("client recovery session cleanup", () => {
  it("clears only server-synced records during logout", async () => {
    const clearForLogout = vi.fn().mockResolvedValue(undefined);

    await expect(
      clearClientRecoveryForLogout("user-1", () => ({
        clearForAccountDeletion: vi.fn(),
        clearForLogout,
      })),
    ).resolves.toBe(true);

    expect(clearForLogout).toHaveBeenCalledWith("user-1");
  });

  it("clears every user recovery record only after account deletion succeeds", async () => {
    const clearForAccountDeletion = vi.fn().mockResolvedValue(undefined);

    await expect(
      clearClientRecoveryForAccountDeletion("user-1", () => ({
        clearForAccountDeletion,
        clearForLogout: vi.fn(),
      })),
    ).resolves.toBe(true);

    expect(clearForAccountDeletion).toHaveBeenCalledWith("user-1");
  });

  it("does not expose storage errors and does not block the session boundary", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      clearClientRecoveryForLogout("user-1", () => ({
        clearForAccountDeletion: vi.fn(),
        clearForLogout: vi
          .fn()
          .mockRejectedValue(new Error("IndexedDB secret failure detail")),
      })),
    ).resolves.toBe(false);

    expect(consoleError).toHaveBeenCalledWith(
      "writing_recovery_cleanup_failed",
      { operation: "logout" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
