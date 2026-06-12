"use client";

/**
 * Shard-local data access for the in-app notification center
 * (`user_notifications`) and the per-channel delivery history
 * (`notification_delivery_attempts`).
 *
 * WHY HERE (not src/lib): both tables are live in dev but
 * `src/lib/supabase/types.ts` (coordinator-owned shared file) is not yet
 * regenerated. Following the learning-settings-data.ts precedent, this module
 * declares the shapes locally and narrows the client at the call site.
 *
 * RLS: user_notifications (owner SELECT; owner UPDATE restricted to the
 * `read_at` column — no insert/delete). notification_delivery_attempts
 * (owner read-only).
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type NotificationCategory =
  | "study"
  | "exam_schedule"
  | "notice"
  | "event"
  | "marketing";

export type UserNotification = {
  id: string;
  template_key: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)) as {
    count: number | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export async function fetchNotifications(
  userId: string,
  limit = 20,
): Promise<UserNotification[]> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("user_notifications")
    .select("id, template_key, category, title, body, link_url, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)) as {
    data: UserNotification[] | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  // RLS scopes the update to the owner's rows; the column grant only allows
  // `read_at`, so no other field can be touched from the client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)) as { error: { message: string } | null };
  if (res.error) throw new Error(res.error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)) as { error: { message: string } | null };
  if (res.error) throw new Error(res.error.message);
}

export type DeliveryHistoryEntry = {
  id: string;
  channel: string;
  template_key: string;
  status: "sent" | "failed" | "pending" | "skipped" | "opted_out" | "deduped";
  sent_at: string | null;
  created_at: string;
};

export async function fetchDeliveryHistory(
  userId: string,
  limit = 5,
): Promise<DeliveryHistoryEntry[]> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any)
    .from("notification_delivery_attempts")
    .select("id, channel, template_key, status, sent_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)) as {
    data: DeliveryHistoryEntry[] | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}
