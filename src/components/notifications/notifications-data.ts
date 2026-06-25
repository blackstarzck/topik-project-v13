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

export type NotificationPayload = Record<string, unknown>;

export type UserNotification = {
  id: string;
  template_key: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link_url: string | null;
  route_path?: string | null;
  navigation_path?: string | null;
  target_path?: string | null;
  destination_path?: string | null;
  move_path?: string | null;
  movement_path?: string | null;
  redirect_path?: string | null;
  path?: string | null;
  payload?: NotificationPayload | null;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_DESTINATION_FIELDS = [
  "route_path",
  "navigation_path",
  "target_path",
  "destination_path",
  "move_path",
  "movement_path",
  "redirect_path",
  "path",
  "link_url",
] as const;

type NotificationDestinationField =
  (typeof NOTIFICATION_DESTINATION_FIELDS)[number];

const NOTIFICATION_PAYLOAD_DESTINATION_FIELDS = [
  "route_path",
  "navigation_path",
  "target_path",
  "destination_path",
  "move_path",
  "movement_path",
  "redirect_path",
  "link_url",
] as const satisfies readonly NotificationDestinationField[];

type NotificationDestinationSource = Partial<
  Record<NotificationDestinationField, unknown>
> & {
  payload?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInternalRoute(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const route = value.trim();
  if (!route) return null;
  if (!route.startsWith("/") || route.startsWith("//")) return null;
  if (/[\u0000-\u001F\u007F]/.test(route)) return null;

  return route;
}

export function resolveNotificationDestination(
  item: NotificationDestinationSource,
): string | null {
  for (const field of NOTIFICATION_DESTINATION_FIELDS) {
    const route = normalizeInternalRoute(item[field]);
    if (route) return route;
  }

  if (isRecord(item.payload)) {
    for (const field of NOTIFICATION_PAYLOAD_DESTINATION_FIELDS) {
      const route = normalizeInternalRoute(item.payload[field]);
      if (route) return route;
    }
  }

  return null;
}

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

export type FetchNotificationsOptions = {
  category?: NotificationCategory;
};

export async function fetchNotifications(
  userId: string,
  limit = 20,
  options: FetchNotificationsOptions = {},
): Promise<UserNotification[]> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("user_notifications")
    .select("*")
    .eq("user_id", userId);

  if (options.category) {
    query = query.eq("category", options.category);
  }

  const res = (await query
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
