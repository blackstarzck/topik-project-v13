"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "../supabase/browser";
import type { Json } from "../supabase/types";
import {
  NOTIFICATION_PREF_KEYS,
  coerceNotificationPrefs,
  type NotificationPrefs,
  type UpdateLocaleInput,
  type UpdateProfileInput,
} from "./types";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;
type ClientFactory = () => BrowserClient;

export class NicknameTakenError extends Error {
  constructor() {
    super("이미 사용 중인 닉네임이에요.");
    this.name = "NicknameTakenError";
  }
}

function isNicknameUniqueError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const text = `${String(candidate.message ?? "")} ${String(
    candidate.details ?? "",
  )}`;
  return (
    candidate.code === "23505" &&
    text.includes("profiles_nickname_lower_uniq")
  );
}

export function profileSettingsQueryKey(userId: string) {
  return ["profile-settings", userId] as const;
}

/**
 * Update `profiles.ui_locale` for the calling user. RLS limits the update to
 * the auth.uid() row.
 */
export async function updateLocale(
  userId: string,
  input: UpdateLocaleInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ui_locale: input.locale })
    .eq("id", userId);
  if (error) throw error;
}

export function useUpdateLocale(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLocaleInput) => updateLocale(userId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileSettingsQueryKey(userId) });
    },
  });
}

/**
 * Update `profiles.display_name` / `profiles.nickname`. Only the provided
 * keys are written so a partial update can null out one column without
 * clobbering the other.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  const supabase = createClient();
  const patch: {
    display_name?: string | null;
    nickname?: string | null;
    bio?: string | null;
  } = {};
  if (Object.prototype.hasOwnProperty.call(input, "display_name")) {
    patch.display_name = input.display_name ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "nickname")) {
    patch.nickname = input.nickname ?? null;
  }
  // Phase 7-E Task 10 (P1-6) — bio mutation.
  if (Object.prototype.hasOwnProperty.call(input, "bio")) {
    patch.bio = input.bio ?? null;
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) {
    if (isNicknameUniqueError(error)) throw new NicknameTakenError();
    throw error;
  }
}

export function useUpdateProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(userId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileSettingsQueryKey(userId) });
    },
  });
}

/**
 * Read-modify-write for `profiles.notification_prefs`.
 *
 * Why read-modify-write instead of `update({ notification_prefs: input })`:
 * the column is a single jsonb object. A naive `.update({ notification_prefs })`
 * would clobber any key not in `input`. This helper reads the current row,
 * filters to the allowed key whitelist, merges the new patch, then writes
 * the full object back. Race-condition note: a concurrent write between the
 * read and write would lose the loser's keys — acceptable for a per-user
 * preference form (no concurrent editors).
 */
export async function updateNotificationPrefs(
  userId: string,
  patch: NotificationPrefs,
  createClient: ClientFactory = createSupabaseBrowserClient,
): Promise<NotificationPrefs> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const current = coerceNotificationPrefs(data?.notification_prefs);

  // Filter patch to known keys (defensive — types already enforce this, but
  // runtime callers might bypass).
  const filteredPatch: NotificationPrefs = {};
  for (const key of NOTIFICATION_PREF_KEYS) {
    const value = patch[key];
    if (typeof value === "boolean") {
      filteredPatch[key] = value;
    }
  }

  const merged: NotificationPrefs = { ...current, ...filteredPatch };
  // Cast through the Json shape required by the typed Supabase client.
  const payload = merged as unknown as Json;
  const { error: writeError } = await supabase
    .from("profiles")
    .update({ notification_prefs: payload })
    .eq("id", userId);
  if (writeError) throw writeError;
  return merged;
}

export function useUpdateNotificationPrefs(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: NotificationPrefs) =>
      updateNotificationPrefs(userId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileSettingsQueryKey(userId) });
    },
  });
}
