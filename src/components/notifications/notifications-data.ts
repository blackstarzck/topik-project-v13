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

export type InstitutionInvitationPayload = {
  invitationId: string | null;
  code: string | null;
  codeLabel: string | null;
};

export type NotificationAction =
  | {
      kind: "institutionInvitation";
      invitation: InstitutionInvitationPayload;
    }
  | {
      kind: "route";
      href: string;
    }
  | {
      kind: "none";
    };

export type InstitutionInvitationResponseStatus =
  | "accepted"
  | "declined"
  | "canceled";

export type InstitutionInvitationResponse = {
  status: InstitutionInvitationResponseStatus;
  code?: string | null;
  code_label?: string | null;
  prev_code?: string | null;
};

export type InstitutionInvitationErrorKind =
  | "alreadyResponded"
  | "canceled"
  | "unauthenticated"
  | "failed";

const INSTITUTION_INVITATION_KEY = "institution_invitation";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  template_key?: unknown;
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

function normalizeDisplayText(value: unknown, maxLength = 120): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function normalizeInvitationId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const invitationId = value.trim();
  return UUID_PATTERN.test(invitationId) ? invitationId : null;
}

export function getInstitutionInvitationPayload(
  item: NotificationDestinationSource,
): InstitutionInvitationPayload | null {
  const payload = isRecord(item.payload) ? item.payload : null;
  const templateKey = normalizeDisplayText(item.template_key);
  const payloadKind = payload ? normalizeDisplayText(payload.kind) : null;

  if (
    templateKey !== INSTITUTION_INVITATION_KEY &&
    payloadKind !== INSTITUTION_INVITATION_KEY
  ) {
    return null;
  }

  return {
    invitationId: normalizeInvitationId(
      payload?.invitation_id ?? payload?.invitationId,
    ),
    code: normalizeDisplayText(payload?.code ?? payload?.affiliation_code),
    codeLabel: normalizeDisplayText(payload?.code_label ?? payload?.codeLabel),
  };
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

export function resolveNotificationAction(
  item: NotificationDestinationSource,
): NotificationAction {
  const invitation = getInstitutionInvitationPayload(item);
  if (invitation) {
    return { kind: "institutionInvitation", invitation };
  }

  const destination = resolveNotificationDestination(item);
  return destination ? { kind: "route", href: destination } : { kind: "none" };
}

function normalizeRpcStatus(
  status: unknown,
): InstitutionInvitationResponseStatus | null {
  return status === "accepted" ||
    status === "declined" ||
    status === "canceled"
    ? status
    : null;
}

export function mapInstitutionInvitationError(
  err: unknown,
): InstitutionInvitationErrorKind {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("canceled") ||
    normalized.includes("cancelled") ||
    normalized.includes("expired") ||
    normalized.includes("revoked")
  ) {
    return "canceled";
  }
  if (normalized.includes("already responded")) return "alreadyResponded";
  if (
    normalized.includes("unauthenticated") ||
    normalized.includes("jwt") ||
    normalized.includes("auth")
  ) {
    return "unauthenticated";
  }

  return "failed";
}

export async function respondInstitutionInvitation(
  invitationId: string,
  accept: boolean,
): Promise<InstitutionInvitationResponse> {
  const supabase = createSupabaseBrowserClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (supabase as any).rpc("respond_institution_invitation", {
    p_invitation_id: invitationId,
    p_accept: accept,
  })) as {
    data: InstitutionInvitationResponse | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);

  const status = normalizeRpcStatus(res.data?.status);
  if (!res.data || !status) {
    throw new Error("unexpected institution invitation response");
  }

  return {
    ...res.data,
    status,
  };
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
