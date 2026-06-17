import { describe, expect, it, vi } from "vitest";
import {
  checkNicknameAvailability,
  NicknameTakenError,
  updateLocale,
  updateNotificationPrefs,
  updateProfile,
} from "../../../src/lib/settings/mutations";

type UpdateCall = {
  table: string;
  patch: Record<string, unknown>;
  id?: string;
};

type RpcCall = {
  fn: string;
  args: Record<string, unknown>;
};

function makeClient(opts: {
  currentPrefs?: unknown;
  selectError?: { message: string } | null;
  updateError?: { code?: string; details?: string; message: string } | null;
  rpcData?: boolean | null;
  rpcError?: { message: string } | null;
  onRpc?: (call: RpcCall) => void;
  onUpdate?: (call: UpdateCall) => void;
}) {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      opts.onRpc?.({ fn, args });
      return Promise.resolve({
        data: opts.rpcData ?? null,
        error: opts.rpcError ?? null,
      });
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: opts.currentPrefs === undefined
                ? null
                : { notification_prefs: opts.currentPrefs },
              error: opts.selectError ?? null,
            }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, value: string) => {
          opts.onUpdate?.({ table, patch, id: value });
          return Promise.resolve({
            data: null,
            error: opts.updateError ?? null,
          });
        },
      }),
    }),
  };
}

describe("updateLocale", () => {
  it("writes ui_locale for the user", async () => {
    const calls: UpdateCall[] = [];
    await updateLocale(
      "user-1",
      { locale: "vi" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ onUpdate: (c) => calls.push(c) }) as any,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      table: "profiles",
      patch: { ui_locale: "vi" },
      id: "user-1",
    });
  });

  it("throws when supabase update fails", async () => {
    await expect(
      updateLocale(
        "user-1",
        { locale: "ko" },
        () =>
          makeClient({
            updateError: { message: "rls denied" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toMatchObject({ message: "rls denied" });
  });
});

describe("checkNicknameAvailability", () => {
  it("calls the nickname availability RPC with the trimmed candidate", async () => {
    const calls: RpcCall[] = [];
    const result = await checkNicknameAvailability(
      "  talkpik-abc123  ",
      () =>
        makeClient({
          rpcData: true,
          onRpc: (call) => calls.push(call),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );

    expect(result).toBe(true);
    expect(calls).toEqual([
      {
        fn: "is_nickname_available",
        args: { candidate: "talkpik-abc123" },
      },
    ]);
  });

  it("returns false when the RPC reports a taken nickname", async () => {
    await expect(
      checkNicknameAvailability(
        "talkpik-taken",
        () =>
          makeClient({
            rpcData: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).resolves.toBe(false);
  });

  it("throws when the RPC fails so the UI can show a retry/fallback state", async () => {
    await expect(
      checkNicknameAvailability(
        "talkpik-error",
        () =>
          makeClient({
            rpcError: { message: "rpc unavailable" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toMatchObject({ message: "rpc unavailable" });
  });
});

describe("updateProfile", () => {
  it("writes only the provided fields (partial patch)", async () => {
    const calls: UpdateCall[] = [];
    await updateProfile(
      "user-1",
      { display_name: "Chan" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ onUpdate: (c) => calls.push(c) }) as any,
    );
    expect(calls[0].patch).toEqual({ display_name: "Chan" });
    expect("nickname" in calls[0].patch).toBe(false);
  });

  it("preserves explicit nulls so the user can clear a field", async () => {
    const calls: UpdateCall[] = [];
    await updateProfile(
      "user-1",
      { nickname: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ onUpdate: (c) => calls.push(c) }) as any,
    );
    expect(calls[0].patch).toEqual({ nickname: null });
  });

  it("Phase 7-E Task 10 — writes bio when provided", async () => {
    const calls: UpdateCall[] = [];
    await updateProfile(
      "user-1",
      { bio: "TOPIK II 4급 목표로 학습 중입니다." },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ onUpdate: (c) => calls.push(c) }) as any,
    );
    expect(calls[0].patch).toEqual({
      bio: "TOPIK II 4급 목표로 학습 중입니다.",
    });
  });

  it("Phase 7-E Task 10 — preserves explicit null bio (clear)", async () => {
    const calls: UpdateCall[] = [];
    await updateProfile(
      "user-1",
      { bio: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ onUpdate: (c) => calls.push(c) }) as any,
    );
    expect(calls[0].patch).toEqual({ bio: null });
  });

  it("no-ops when no keys provided", async () => {
    const calls: UpdateCall[] = [];
    await updateProfile(
      "user-1",
      {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ onUpdate: (c) => calls.push(c) }) as any,
    );
    expect(calls).toHaveLength(0);
  });

  it("maps nickname unique constraint failures to a dedicated error", async () => {
    await expect(
      updateProfile(
        "user-1",
        { nickname: "talkpik-000000" },
        () =>
          makeClient({
            updateError: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "profiles_nickname_lower_uniq"',
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toBeInstanceOf(NicknameTakenError);
  });
});

describe("updateNotificationPrefs (read-modify-write)", () => {
  it("merges patch into existing prefs without clobbering other keys", async () => {
    const calls: UpdateCall[] = [];
    const merged = await updateNotificationPrefs(
      "user-1",
      { study_reminder: true },
      () =>
        makeClient({
          currentPrefs: { weekly_summary: true, feedback_ready: false },
          onUpdate: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(merged).toEqual({
      weekly_summary: true,
      feedback_ready: false,
      study_reminder: true,
    });
    expect(calls[0].patch).toEqual({
      notification_prefs: {
        weekly_summary: true,
        feedback_ready: false,
        study_reminder: true,
      },
    });
  });

  it("overwrites a key with the new value when patch sets it", async () => {
    const calls: UpdateCall[] = [];
    const merged = await updateNotificationPrefs(
      "user-1",
      { weekly_summary: false },
      () =>
        makeClient({
          currentPrefs: { weekly_summary: true, study_reminder: true },
          onUpdate: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(merged).toEqual({
      weekly_summary: false,
      study_reminder: true,
    });
  });

  it("filters out unknown keys from the patch", async () => {
    const calls: UpdateCall[] = [];
    await updateNotificationPrefs(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { weekly_summary: true, bogus: true } as any,
      () =>
        makeClient({
          currentPrefs: {},
          onUpdate: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(calls[0].patch).toEqual({
      notification_prefs: { weekly_summary: true },
    });
  });

  it("treats null/missing current prefs as empty object", async () => {
    const calls: UpdateCall[] = [];
    const merged = await updateNotificationPrefs(
      "user-1",
      { feedback_ready: true },
      () =>
        makeClient({
          currentPrefs: null,
          onUpdate: (c) => calls.push(c),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
    expect(merged).toEqual({ feedback_ready: true });
    expect(calls[0].patch).toEqual({
      notification_prefs: { feedback_ready: true },
    });
  });

  it("throws when the read step errors", async () => {
    await expect(
      updateNotificationPrefs(
        "user-1",
        { weekly_summary: true },
        () =>
          makeClient({
            currentPrefs: {},
            selectError: { message: "select boom" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toMatchObject({ message: "select boom" });
  });

  it("throws when the write step errors", async () => {
    await expect(
      updateNotificationPrefs(
        "user-1",
        { weekly_summary: true },
        () =>
          makeClient({
            currentPrefs: {},
            updateError: { message: "write boom" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toMatchObject({ message: "write boom" });
  });
});

// Smoke check that mutation hooks exist and are wired (without rendering React).
import {
  useUpdateLocale,
  useUpdateNotificationPrefs,
  useUpdateProfile,
} from "../../../src/lib/settings/mutations";

describe("mutation hooks exports", () => {
  it("exports the three hooks", () => {
    expect(typeof useUpdateLocale).toBe("function");
    expect(typeof useUpdateNotificationPrefs).toBe("function");
    expect(typeof useUpdateProfile).toBe("function");
  });

  it("silences unused vi import", () => {
    // The `vi` import is exposed in case future tests need spies on
    // window/auth. Keep the import resolved.
    expect(typeof vi).toBe("object");
  });
});
