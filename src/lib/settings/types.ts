import type { UiLocaleSource } from "@/i18n/detection";

export type { UiLocaleSource };

/**
 * Phase 6 · Settings domain types.
 *
 * Notification prefs key catalog (code-level fallback per migration
 * 20260521141000_phase_6_notification_prefs.sql — DB only enforces
 * `jsonb_typeof = 'object'`, not the key whitelist). Missing key == false.
 *
 * Transport (email/push) is OOS-9; Phase 6 only persists the preference.
 */

export type NotificationPrefKey =
  | "weekly_summary"
  | "feedback_ready"
  | "study_reminder";

export const NOTIFICATION_PREF_KEYS: readonly NotificationPrefKey[] = [
  "weekly_summary",
  "feedback_ready",
  "study_reminder",
] as const;

/**
 * Sparse map: missing keys are treated as `false` by both DB-side reads and
 * UI render. Never write keys outside `NOTIFICATION_PREF_KEYS` — server-side
 * merge in `useUpdateNotificationPrefs` filters unknown keys defensively.
 */
export type NotificationPrefs = Partial<Record<NotificationPrefKey, boolean>>;

export interface ProfileSettings {
  display_name: string | null;
  nickname: string | null;
  nationality_country_code: string | null;
  // Optional self-reported phone number (digits-only or null). Collected at
  // signup/auth completion; editable on /profile.
  phone_country_code: string | null;
  phone_number: string | null;
  // Phase 7-E Task 10 (P1-6) — self-introduction up to 160 chars (nullable).
  bio: string | null;
  ui_locale: "ko" | "en" | "vi";
  ui_locale_source: UiLocaleSource;
  notification_prefs: NotificationPrefs;
}

export interface UpdateLocaleInput {
  locale: "ko" | "en" | "vi";
  source: Extract<UiLocaleSource, "manual">;
}

export interface UpdateProfileInput {
  display_name?: string | null;
  nickname?: string | null;
  nationality_country_code?: string | null;
  // Optional phone number. DB CHECK enforces digits-only or null.
  phone_country_code?: string | null;
  phone_number?: string | null;
  // Phase 7-E Task 10 — bio mutation. DB CHECK char_length <= 160.
  bio?: string | null;
}

/**
 * Coerce arbitrary `Json` (from DB) into a typed sparse map. Drops unknown
 * keys and non-boolean values defensively — the DB check only enforces
 * `jsonb_typeof = 'object'`, so legacy or buggy writes might leak through.
 */
export function coerceNotificationPrefs(raw: unknown): NotificationPrefs {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NotificationPrefs = {};
  for (const key of NOTIFICATION_PREF_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}
