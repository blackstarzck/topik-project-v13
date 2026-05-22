import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { coerceNotificationPrefs, type ProfileSettings } from "./types";

type ClientFactory = () => Promise<SupabaseServerClient>;

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
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, nickname, ui_locale, notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `getProfileSettings failed for ${userId}: ${error.message}`,
    );
  }
  if (!data) return null;
  return {
    display_name: data.display_name,
    nickname: data.nickname,
    ui_locale: data.ui_locale,
    notification_prefs: coerceNotificationPrefs(data.notification_prefs),
  };
}
