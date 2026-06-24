import { expect, test, type Route } from "@playwright/test";

const NOTIFICATIONS_ROUTE = "**/rest/v1/user_notifications**";

const notificationRows = [
  {
    id: "e2e-no-route",
    user_id: "e2e-user",
    template_key: "notice",
    category: "notice",
    title: "No route notice",
    body: "This notification only marks read.",
    link_url: null,
    route_path: null,
    read_at: null,
    created_at: "2026-06-22T09:00:00.000Z",
  },
  {
    id: "e2e-route",
    user_id: "e2e-user",
    template_key: "feedback_ready",
    category: "study",
    title: "Route path notice",
    body: "This notification moves to practice.",
    link_url: null,
    route_path: "/practice/problems",
    read_at: null,
    created_at: "2026-06-22T09:01:00.000Z",
  },
];

async function fulfillNotifications(route: Route) {
  const method = route.request().method();
  if (method === "HEAD") {
    await route.fulfill({
      status: 200,
      headers: {
        "content-range": "0-1/2",
        "range-unit": "items",
      },
      body: "",
    });
    return;
  }

  if (method === "PATCH") {
    await route.fulfill({ status: 204, body: "" });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(notificationRows),
  });
}

test("dashboard notification rows move only when a route path exists", async ({
  page,
}) => {
  await page.route(NOTIFICATIONS_ROUTE, fulfillNotifications);

  await page.goto("/dashboard");

  const noRoute = page.locator(".app-notification-feed-item__button", {
    hasText: "No route notice",
  });
  const withRoute = page.locator(".app-notification-feed-item__button", {
    hasText: "Route path notice",
  });

  await expect(noRoute).toBeVisible({ timeout: 15_000 });
  await expect(withRoute).toBeVisible();

  await noRoute.click();
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/);

  await withRoute.click();
  await expect(page).toHaveURL(/\/practice\/problems/);
});
