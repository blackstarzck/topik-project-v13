// TEMP seed (not committed) — ensures the ntf optin user exists with a known
// password, has a notification_settings row, and has at least one PERSISTENT
// unread user_notifications row for the error-state e2e tests (N-INB-09/11).
// Uses the service (secret) key. Idempotent.
//
// Run from v13-notif with env injected from topik-ai-notif/.env.local.
import { createClient } from "@supabase/supabase-js";

const URL_BASE = process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = process.env.E2E_NTF_PASSWORD ?? "Ntf-e2e-2026!seed";
const EMAIL = "ntf-user-optin@e2e-notification.test";
const MARKER = "e2e-error-state-persistent"; // stable template_key marker

if (!URL_BASE || !SECRET) {
  console.error("VITE_SUPABASE_URL + SUPABASE_SECRET_KEY required");
  process.exit(1);
}
if (/prod/i.test(URL_BASE)) {
  console.error("refusing to run against a production-looking URL");
  process.exit(1);
}

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
    console.log("user created", j.id);
    return j.id;
  }
  // already exists -> find id via admin list and reset password
  const list = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=200`, {
    headers,
  });
  const lj = await list.json();
  const found = (lj.users ?? []).find((u) => u.email === EMAIL);
  if (!found) {
    console.error("user not creatable and not found:", await res.text());
    process.exit(1);
  }
  // reset password + confirm so password login works
  await fetch(`${URL_BASE}/auth/v1/admin/users/${found.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
  });
  console.log("user existed -> password reset", found.id);
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
  console.log("settings upsert", sErr ? "ERR " + sErr.message : "ok");

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
    console.log("notification inserted", iErr ? "ERR " + iErr.message : "ok");
  } else {
    // make sure it's unread again
    await service
      .from("user_notifications")
      .update({ read_at: null })
      .eq("user_id", uid)
      .eq("template_key", MARKER);
    console.log("notification existed -> reset to unread");
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
  console.log("UID", uid);
}

main().catch((e) => {
  console.error("SEED FAILED", e);
  process.exit(1);
});
