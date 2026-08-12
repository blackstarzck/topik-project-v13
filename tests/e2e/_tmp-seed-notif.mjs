// TEMP seed (not committed) — ensures the ntf optin user exists with a known
// password, has a notification_settings row, and has at least one PERSISTENT
// unread user_notifications row for the error-state e2e tests (N-INB-09/11).
// Uses the service (secret) key. Idempotent.
//
// Run only against an explicitly enabled numeric-loopback Supabase stack.
import { createClient } from "@supabase/supabase-js";
import { assertLocalPrivilegedMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";

const URL_BASE = process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = process.env.E2E_NTF_PASSWORD;
const EMAIL = "ntf-user-optin@e2e-notification.test";
const MARKER = "e2e-error-state-persistent"; // stable template_key marker

if (!URL_BASE || !SECRET || !PASSWORD) {
  console.error("local_notification_seed_configuration_missing");
  process.exit(1);
}

assertLocalPrivilegedMutationTarget({
  ...process.env,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: URL_BASE,
  SUPABASE_SECRET_KEY: SECRET,
});

const service = createClient(URL_BASE, SECRET, {
  auth: { persistSession: false },
});

async function ensureUser() {
  const headers = {
    apikey: SECRET,
    Authorization: `Bearer ${SECRET}`,
    "Content-Type": "application/json",
  };
  // Try create; if exists, reset password so the known password works.
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    }),
  });
  if (res.ok) {
    const j = await res.json();
    console.log("local_notification_user_created");
    return j.id;
  }
  // already exists -> find id via admin list and reset password
  const list = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=200`, {
    headers,
  });
  const lj = await list.json();
  const found = (lj.users ?? []).find((u) => u.email === EMAIL);
  if (!found) {
    console.error("local_notification_user_prepare_failed");
    process.exit(1);
  }
  // reset password + confirm so password login works
  const reset = await fetch(`${URL_BASE}/auth/v1/admin/users/${found.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
  });
  if (!reset.ok) throw new Error("local_notification_user_reset_failed");
  console.log("local_notification_user_reused");
  return found.id;
}

async function main() {
  const uid = await ensureUser();

  // profiles row (FK target for settings/notifications); upsert is safe.
  await service
    .from("profiles")
    .upsert(
      { id: uid, display_name: EMAIL.split("@")[0] },
      { onConflict: "id" },
    );

  // notification_settings row (optin: in_app on).
  const { error: sErr } = await service.from("notification_settings").upsert(
    {
      user_id: uid,
      reminder_time: "09:00:00",
      reminder_days: [1, 2, 3, 4, 5],
      channels: { in_app: true, email: true, zalo: false },
      timezone: "Asia/Seoul",
    },
    { onConflict: "user_id" },
  );
  if (sErr) throw new Error("local_notification_settings_seed_failed");
  console.log("local_notification_settings_seeded");

  // Ensure exactly one persistent UNREAD notification (idempotent by marker).
  const { data: existing } = await service
    .from("user_notifications")
    .select("id, read_at")
    .eq("user_id", uid)
    .eq("template_key", MARKER);
  if ((existing ?? []).length === 0) {
    const { error: iErr } = await service.from("user_notifications").insert({
      user_id: uid,
      template_key: MARKER,
      category: "study",
      title: "오류 상태 테스트 알림",
      body: "이 알림은 N-INB-09/11 테스트용 영구 미읽음 항목입니다.",
      link_url: null,
    });
    if (iErr) throw new Error("local_notification_insert_failed");
    console.log("local_notification_inserted");
  } else {
    // make sure it's unread again
    await service
      .from("user_notifications")
      .update({ read_at: null })
      .eq("user_id", uid)
      .eq("template_key", MARKER);
    console.log("local_notification_reused");
  }

  // Report final inbox state.
  const { data: all } = await service
    .from("user_notifications")
    .select("id, read_at")
    .eq("user_id", uid);
  console.log(
    "INBOX total",
    (all ?? []).length,
    "unread",
    (all ?? []).filter((r) => !r.read_at).length,
  );
  console.log("local_notification_seed_complete");
}

main().catch(() => {
  console.error("local_notification_seed_failed");
  process.exit(1);
});
