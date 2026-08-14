import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";

const TEMPLATE_PREFIX = "e2e-db-route-path";
const TARGET_ROUTE = "/practice/problems";
const ROUTE_FIELD_CANDIDATES = [
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

type RouteField = (typeof ROUTE_FIELD_CANDIDATES)[number];
type NotificationSeed = {
  userId: string;
  routeNotificationId: string;
  noRouteNotificationId: string;
  routeField: RouteField;
  marker: string;
  routeTitle: string;
  noRouteTitle: string;
};

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "Supabase DB-backed notification e2e requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
);

const service = createClient(SUPABASE_URL ?? "", SERVICE_ROLE_KEY ?? "", {
  auth: { persistSession: false },
});

async function findUserIdByEmail(client: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error("notification_fixture_user_lookup_failed");

    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }

  throw new Error(`E2E student user not found: ${email}`);
}

function isMissingRouteColumnError(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST204" ||
    /column/i.test(error.message) ||
    /schema cache/i.test(error.message)
  );
}

async function insertRouteNotification(params: {
  userId: string;
  id: string;
  marker: string;
  title: string;
  createdAt: string;
}) {
  const baseRow = {
    id: params.id,
    user_id: params.userId,
    template_key: `${params.marker}-with-route`,
    category: "study",
    title: params.title,
    body: "DB-backed e2e notification with a movement route.",
    link_url: null,
    read_at: null,
    created_at: params.createdAt,
  };

  for (const field of ROUTE_FIELD_CANDIDATES) {
    const { error } = await service.from("user_notifications").insert({
      ...baseRow,
      [field]: TARGET_ROUTE,
    });
    if (!error) return field;

    if (field !== "link_url" && isMissingRouteColumnError(error)) continue;
    throw new Error("notification_fixture_insert_failed");
  }

  throw new Error("No route field candidate could be inserted.");
}

async function seedNotifications(
  projectName: string,
): Promise<NotificationSeed> {
  const userId = await findUserIdByEmail(service, STUDENT_EMAIL);
  const marker = `${TEMPLATE_PREFIX}-${projectName.replace(/\W+/g, "-")}-${Date.now()}`;
  const routeNotificationId = randomUUID();
  const noRouteNotificationId = randomUUID();
  const routeTitle = `E2E DB route notice ${marker}`;
  const noRouteTitle = `E2E DB no route notice ${marker}`;
  const baseTime = Date.now() + 60_000;

  const routeField = await insertRouteNotification({
    userId,
    id: routeNotificationId,
    marker,
    title: routeTitle,
    createdAt: new Date(baseTime + 1_000).toISOString(),
  });

  const { error } = await service.from("user_notifications").insert({
    id: noRouteNotificationId,
    user_id: userId,
    template_key: `${marker}-no-route`,
    category: "notice",
    title: noRouteTitle,
    body: "DB-backed e2e notification without a movement route.",
    link_url: null,
    read_at: null,
    created_at: new Date(baseTime).toISOString(),
  });
  if (error) throw new Error("notification_fixture_read_failed");

  return {
    userId,
    routeNotificationId,
    noRouteNotificationId,
    routeField,
    marker,
    routeTitle,
    noRouteTitle,
  };
}

async function cleanupNotifications(seed: Pick<NotificationSeed, "marker">) {
  await service
    .from("user_notifications")
    .delete()
    .like("template_key", `${seed.marker}%`);
}

async function readAtFor(id: string) {
  const { data, error } = await service
    .from("user_notifications")
    .select("read_at")
    .eq("id", id)
    .single();
  if (error) throw new Error("notification_fixture_cleanup_failed");
  return data.read_at as string | null;
}

test("dashboard clicks real DB notifications only navigate when a route exists", async ({
  page,
}, testInfo) => {
  const seed = await seedNotifications(testInfo.project.name);
  testInfo.annotations.push({
    type: "route-field",
    description: seed.routeField,
  });

  try {
    await page.goto("/dashboard");

    const noRoute = page.locator(".app-notification-feed-item__button", {
      hasText: seed.noRouteTitle,
    });
    const withRoute = page.locator(".app-notification-feed-item__button", {
      hasText: seed.routeTitle,
    });

    await expect(noRoute).toBeVisible({ timeout: 15_000 });
    await expect(withRoute).toBeVisible();

    await noRoute.click();
    await expect(page).toHaveURL(/\/dashboard(?:$|\?)/);
    await expect
      .poll(() => readAtFor(seed.noRouteNotificationId))
      .not.toBeNull();

    await withRoute.click();
    await expect(page).toHaveURL(/\/practice\/problems/);
    await expect.poll(() => readAtFor(seed.routeNotificationId)).not.toBeNull();
  } finally {
    await cleanupNotifications(seed);
  }
});
