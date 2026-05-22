import { describe, expect, it } from "vitest";
import { getProfileSettings } from "../../../src/lib/settings/server";

type RowShape = {
  display_name: string | null;
  nickname: string | null;
  ui_locale: "ko" | "en" | "vi";
  notification_prefs: unknown;
} | null;

function makeClient(opts: {
  data?: RowShape;
  error?: { message: string } | null;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: opts.data ?? null,
              error: opts.error ?? null,
            }),
        }),
      }),
    }),
  };
}

describe("getProfileSettings", () => {
  it("returns the typed projection when row exists", async () => {
    const row = {
      display_name: "Chan",
      nickname: "찬",
      ui_locale: "ko" as const,
      notification_prefs: { weekly_summary: true, feedback_ready: false },
    };
    const result = await getProfileSettings(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async () => makeClient({ data: row }) as any,
    );
    expect(result).toEqual({
      display_name: "Chan",
      nickname: "찬",
      ui_locale: "ko",
      notification_prefs: { weekly_summary: true, feedback_ready: false },
    });
  });

  it("coerces unknown / non-boolean notification_prefs keys away", async () => {
    const row = {
      display_name: null,
      nickname: null,
      ui_locale: "en" as const,
      // includes one unknown key and one non-boolean value — both must be dropped.
      notification_prefs: {
        weekly_summary: true,
        bogus: true,
        feedback_ready: "yes",
      },
    };
    const result = await getProfileSettings(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async () => makeClient({ data: row }) as any,
    );
    expect(result?.notification_prefs).toEqual({ weekly_summary: true });
  });

  it("returns null when row is not visible (RLS)", async () => {
    const result = await getProfileSettings(
      "user-x",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async () => makeClient({ data: null }) as any,
    );
    expect(result).toBe(null);
  });

  it("throws when supabase errors", async () => {
    await expect(
      getProfileSettings(
        "user-1",
        async () =>
          makeClient({
            data: null,
            error: { message: "rls denied" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toThrow(/rls denied/);
  });
});
