import { describe, expect, it } from "vitest";
import { getProfileSettings } from "../../../src/lib/settings/server";
import type { SupabaseServerClient } from "../../../src/lib/supabase/server";

type RowShape = {
  display_name: string | null;
  nickname: string | null;
  nationality_country_code?: string | null;
  ui_locale: "ko" | "en" | "vi";
  ui_locale_source: "legacy" | "default" | "auto" | "manual";
  notification_prefs: unknown;
} | null;

function makeClient(opts: {
  data?: RowShape;
  error?: { message: string } | null;
  onSelect?: (columns: string) => void;
}): SupabaseServerClient {
  return {
    from: () => ({
      select: (columns: string) => {
        opts.onSelect?.(columns);
        return {
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: opts.data ?? null,
                error: opts.error ?? null,
              }),
          }),
        };
      },
    }),
  } as unknown as SupabaseServerClient;
}

describe("getProfileSettings", () => {
  it("returns the typed projection when row exists", async () => {
    const row = {
      display_name: "Chan",
      nickname: "찬",
      // Phase 7-E Task 10 — bio column.
      bio: "TOPIK II 4급 목표로 학습 중입니다.",
      ui_locale: "ko" as const,
      ui_locale_source: "manual" as const,
      notification_prefs: { weekly_summary: true, feedback_ready: false },
    };
    const result = await getProfileSettings("user-1", async () =>
      makeClient({ data: row }),
    );
    expect(result).toEqual({
      display_name: "Chan",
      nickname: "찬",
      nationality_country_code: null,
      bio: "TOPIK II 4급 목표로 학습 중입니다.",
      ui_locale: "ko",
      ui_locale_source: "manual",
      notification_prefs: { weekly_summary: true, feedback_ready: false },
    });
  });

  it("Phase 7-E Task 10 — returns bio as null when DB value is null", async () => {
    const row = {
      display_name: null,
      nickname: null,
      bio: null,
      ui_locale: "ko" as const,
      ui_locale_source: "default" as const,
      notification_prefs: {},
    };
    const result = await getProfileSettings("user-2", async () =>
      makeClient({ data: row }),
    );
    expect(result?.bio).toBeNull();
  });

  it("includes nationality_country_code in the profile settings projection", async () => {
    const selectedColumns: string[] = [];
    const result = await getProfileSettings("user-3", async () =>
      makeClient({
        data: {
          display_name: null,
          nickname: null,
          nationality_country_code: "VN",
          ui_locale: "ko",
          ui_locale_source: "auto",
          notification_prefs: {},
        },
        onSelect: (columns) => selectedColumns.push(columns),
      }),
    );

    expect(selectedColumns[0]).toContain("nationality_country_code");
    expect(selectedColumns[0]).toContain("ui_locale_source");
    expect(result?.nationality_country_code).toBe("VN");
  });

  it("coerces unknown / non-boolean notification_prefs keys away", async () => {
    const row = {
      display_name: null,
      nickname: null,
      ui_locale: "en" as const,
      ui_locale_source: "legacy" as const,
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
