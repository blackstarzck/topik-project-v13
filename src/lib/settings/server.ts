import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { coerceNotificationPrefs, type ProfileSettings } from "./types";

type ClientFactory = () => Promise<SupabaseServerClient>;

const PROFILE_SETTINGS_COLUMNS =
  "display_name, nickname, nationality_country_code, phone_country_code, phone_number, bio, ui_locale, ui_locale_source, notification_prefs";
// Legacy projection intentionally omits optional-profile columns and
// ui_locale_source so the page still loads on environments where the latest
// profile migrations have not been applied yet; toProfileSettings maps the
// absent columns to null / legacy.
const LEGACY_PROFILE_SETTINGS_COLUMNS =
  "display_name, nickname, nationality_country_code, bio, ui_locale, notification_prefs";

type ProfileSettingsRow = {
  display_name: string | null;
  nickname: string | null;
  nationality_country_code?: string | null;
  phone_country_code?: string | null;
  phone_number?: string | null;
  bio: string | null;
  ui_locale: ProfileSettings["ui_locale"];
  ui_locale_source?: ProfileSettings["ui_locale_source"] | null;
  notification_prefs: unknown;
};

function isMissingOptionalProfileColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const text = String(candidate.message ?? "").toLowerCase();
  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    text.includes("ui_locale_source") ||
    text.includes("phone_country_code") ||
    text.includes("phone_number")
  );
}

async function selectProfileSettings(
  supabase: SupabaseServerClient,
  userId: string,
  columns: string,
) {
  return supabase
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();
}

function toProfileSettings(data: ProfileSettingsRow): ProfileSettings {
  return {
    display_name: data.display_name,
    nickname: data.nickname,
    nationality_country_code: data.nationality_country_code ?? null,
    phone_country_code: data.phone_country_code ?? null,
    phone_number: data.phone_number ?? null,
    bio: data.bio,
    ui_locale: data.ui_locale,
    ui_locale_source: data.ui_locale_source ?? "legacy",
    notification_prefs: coerceNotificationPrefs(data.notification_prefs),
  };
}

/**
 * Server-only: fetch the settings projection for the given user. RLS-bound
 * (`profiles_self_select` allows `id = auth.uid()` or platform admin), so a
 * `null` return means the caller is not the row's owner or no auth session.
 */
export async function getProfileSettings(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<ProfileSettings | null> {
  const supabase = await createClient();
  let { data, error } = await selectProfileSettings(
    supabase,
    userId,
    PROFILE_SETTINGS_COLUMNS,
  );

  if (error && isMissingOptionalProfileColumnError(error)) {
    const legacyResult = await selectProfileSettings(
      supabase,
      userId,
      LEGACY_PROFILE_SETTINGS_COLUMNS,
    );
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(
      `getProfileSettings failed for ${userId}: ${error.message}`,
    );
  }
  if (!data) return null;
  return toProfileSettings(data as unknown as ProfileSettingsRow);
}
