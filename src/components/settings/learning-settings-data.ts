"use client";

/**
 * Shard-local data access for the G-01 learning-locale + content-prefs columns
 * and the X-09 notification_settings/notification_log tables.
 *
 * WHY HERE (not src/lib): migrations 20260602120200 added
 * `profiles.learning_locale`, `profiles.content_prefs`, `notification_settings`,
 * and `notification_log`, but `src/lib/supabase/types.ts` (coordinator-owned
 * shared file) is not yet regenerated. To wire real data now without editing a
 * shared file, this module declares the shapes locally and narrows the client
 * at the call site. See proposedCatalogChanges for the snapshot follow-up.
 *
 * RLS: profiles (owner self-update; learning_locale/content_prefs are NOT
 * guarded by protect_profile_columns). notification_settings (owner full
 * control, upsertable). notification_log (owner read-only).
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type LearningLocale = "ko" | "en" | "vi";

export type ContentPrefs = {
  feedback_display?: "full" | "summary";
  example_difficulty?: "easy" | "standard" | "hard";
  explanation_length?: "short" | "standard" | "detailed";
};

export const CONTENT_PREF_DEFAULTS: Required<ContentPrefs> = {
  feedback_display: "full",
  example_difficulty: "standard",
  explanation_length: "standard",
};

export type LearningSettings = {
  learning_locale: LearningLocale | null;
  content_prefs: ContentPrefs;
};

function coerceContentPrefs(raw: unknown): ContentPrefs {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: ContentPrefs = {};
  if (obj.feedback_display === "full" || obj.feedback_display === "summary") {
    out.feedback_display = obj.feedback_display;
  }
  if (
    obj.example_difficulty === "easy" ||
    obj.example_difficulty === "standard" ||
    obj.example_difficulty === "hard"
  ) {
    out.example_difficulty = obj.example_difficulty;
  }
  if (
    obj.explanation_length === "short" ||
    obj.explanation_length === "standard" ||
    obj.explanation_length === "detailed"
  ) {
    out.explanation_length = obj.explanation_length;
  }
  return out;
}

export async function fetchLearningSettings(
  userId: string,
): Promise<LearningSettings> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("profiles")
    .select("learning_locale, content_prefs")
    .eq("id", userId)
    .maybeSingle()) as {
    data: { learning_locale: string | null; content_prefs: unknown } | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  const locale = res.data?.learning_locale;
  return {
    learning_locale:
      locale === "ko" || locale === "en" || locale === "vi" ? locale : null,
    content_prefs: coerceContentPrefs(res.data?.content_prefs),
  };
}

export async function updateLearningSettings(
  userId: string,
  patch: {
    learning_locale?: LearningLocale | null;
    content_prefs?: ContentPrefs;
  },
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const update: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(patch, "learning_locale")) {
    update.learning_locale = patch.learning_locale ?? null;
  }
  if (patch.content_prefs) {
    update.content_prefs = patch.content_prefs;
  }
  if (Object.keys(update).length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("profiles")
    .update(update)
    .eq("id", userId)) as { error: { message: string } | null };
  if (res.error) throw new Error(res.error.message);
}

/**
 * Conflict rule (G-01 region 4 예외): "요약 피드백 + 자세한 해설" is
 * contradictory — a summary-first reader does not want long explanations.
 * When detected we surface a warning + a restore-to-recommended action.
 */
export function detectContentPrefConflict(prefs: ContentPrefs): boolean {
  return (
    prefs.feedback_display === "summary" &&
    prefs.explanation_length === "detailed"
  );
}

// ---------------------------------------------------------------------------
// X-09 notification_settings + notification_log
// ---------------------------------------------------------------------------

/**
 * Channel contract (topik-ai docs/specs/notification-contract.md):
 * allowed keys are in_app / email / push / zalo. This screen persists
 * in_app / email / zalo today (push is provider-less "준비 중" and has no
 * toggle yet). Rows written before 2026-06-12 lack the in_app key —
 * missing in_app is read as TRUE (in-app은 기본 수신 채널).
 */
export type NotificationChannels = {
  in_app: boolean;
  email: boolean;
  zalo: boolean;
};

export type NotificationSettings = {
  reminder_time: string | null; // "HH:mm[:ss]"
  reminder_days: number[]; // 0=Sun..6=Sat
  channels: NotificationChannels;
  timezone: string;
};

export const NOTIFICATION_SETTINGS_DEFAULTS: NotificationSettings = {
  reminder_time: null,
  reminder_days: [],
  channels: { in_app: true, email: false, zalo: false },
  timezone: "Asia/Seoul",
};

function coerceChannels(raw: unknown): NotificationChannels {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { in_app: true, email: false, zalo: false };
  }
  const obj = raw as Record<string, unknown>;
  return {
    // missing key = true (legacy rows predate the in_app contract)
    in_app: obj.in_app !== false,
    email: obj.email === true,
    zalo: obj.zalo === true,
  };
}

function coerceDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is number => typeof d === "number" && d >= 0 && d <= 6,
  );
}

export async function fetchNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("notification_settings")
    .select("reminder_time, reminder_days, channels, timezone")
    .eq("user_id", userId)
    .maybeSingle()) as {
    data: {
      reminder_time: string | null;
      reminder_days: unknown;
      channels: unknown;
      timezone: string | null;
    } | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return { ...NOTIFICATION_SETTINGS_DEFAULTS };
  return {
    reminder_time: res.data.reminder_time,
    reminder_days: coerceDays(res.data.reminder_days),
    channels: coerceChannels(res.data.channels),
    timezone: res.data.timezone ?? "Asia/Seoul",
  };
}

export async function upsertNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any).from("notification_settings").upsert(
    {
      user_id: userId,
      reminder_time: settings.reminder_time,
      reminder_days: settings.reminder_days,
      channels: settings.channels,
      timezone: settings.timezone,
    },
    { onConflict: "user_id" },
  )) as { error: { message: string } | null };
  if (res.error) throw new Error(res.error.message);
}

export type NotificationLogEntry = {
  id: string;
  channel: string;
  template_key: string;
  status: "sent" | "failed" | "pending";
  sent_at: string | null;
  created_at: string;
};

/**
 * @deprecated The X-09 발송 이력 panel now reads
 * `notification_delivery_attempts` via `fetchDeliveryHistory` in
 * src/components/notifications/notifications-data.ts. Kept until the
 * notification_log table is retired.
 */
export async function fetchNotificationLog(
  userId: string,
  limit = 5,
): Promise<NotificationLogEntry[]> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("notification_log")
    .select("id, channel, template_key, status, sent_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)) as {
    data: NotificationLogEntry[] | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}
