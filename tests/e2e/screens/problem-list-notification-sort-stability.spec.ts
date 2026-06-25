import { expect, test, type Page, type Route } from "@playwright/test";

const NOTIFICATIONS_ROUTE = "**/rest/v1/user_notifications**";

const notificationRows = [
  {
    id: "e2e-problem-list-sort-notice-1",
    user_id: "e2e-user",
    template_key: "problem_list_sort_stability",
    category: "study",
    title: "Sort stability notice",
    body: "Opening notifications should not move problem rows.",
    link_url: null,
    route_path: null,
    read_at: null,
    created_at: "2026-06-25T09:00:00.000Z",
  },
  {
    id: "e2e-problem-list-sort-notice-2",
    user_id: "e2e-user",
    template_key: "problem_list_sort_stability_read",
    category: "notice",
    title: "Read stability notice",
    body: "A read notification keeps the inbox populated.",
    link_url: null,
    route_path: null,
    read_at: "2026-06-25T09:05:00.000Z",
    created_at: "2026-06-25T08:59:00.000Z",
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

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function visibleProblemTitles(page: Page) {
  const titles = page.locator(".problem-table__title");
  await expect(titles.first()).toBeVisible({ timeout: 15_000 });
  return titles.allTextContents();
}

test("C-02 problem list keeps visible row order after notification inbox loads", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const errors = collectErrors(page);
  await page.route(NOTIFICATIONS_ROUTE, fulfillNotifications);

  await page.goto("/practice/problems?sort=newest", {
    waitUntil: "domcontentloaded",
  });

  await expect(page, "student auth state should remain valid").not.toHaveURL(
    /\/login/,
  );

  const before = await visibleProblemTitles(page);
  expect(before.length).toBeGreaterThan(0);

  await page.locator(".app-notification-bell").click();
  await expect(page.locator(".app-notification-panel")).toBeVisible();
  await expect(page.locator(".app-notification-item")).toHaveCount(2);

  await expect
    .poll(() => visibleProblemTitles(page), {
      message: "visible problem row order should stay stable",
    })
    .toEqual(before);
  expect(errors).toEqual([]);
});
