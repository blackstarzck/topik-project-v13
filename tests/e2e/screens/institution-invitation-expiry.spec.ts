import { expect, test, type Page, type Route } from "@playwright/test";

const NOTIFICATIONS_ROUTE = "**/rest/v1/user_notifications**";
const INVITATION_ID = "2a2ff7b8-cc31-4f4d-a455-283aaad28f30";
const DAY_MS = 86_400_000;

type NotificationRow = {
  id: string;
  user_id: string;
  template_key: string;
  category: "notice";
  title: string;
  body: string;
  link_url: null;
  route_path: null;
  payload?: Record<string, unknown>;
  read_at: null;
  created_at: string;
};

function makeInvitationRow(expiresAt: string): NotificationRow {
  return {
    id: "e2e-institution-invitation-" + expiresAt,
    user_id: "e2e-user",
    template_key: "institution_invitation",
    category: "notice",
    title: "Institution invitation",
    body: "A new institution invitation is waiting.",
    link_url: null,
    route_path: null,
    payload: {
      kind: "institution_invitation",
      invitation_id: INVITATION_ID,
      code: "CAMPAIGN-01",
      code_label: "Campaign",
      expires_at: expiresAt,
    },
    read_at: null,
    created_at: "2026-06-25T09:00:00.000Z",
  };
}

function makeOrdinaryRow(): NotificationRow {
  return {
    id: "e2e-ordinary-notice",
    user_id: "e2e-user",
    template_key: "ordinary_notice",
    category: "notice",
    title: "Ordinary notice",
    body: "This notification has no invitation expiry.",
    link_url: null,
    route_path: null,
    payload: {},
    read_at: null,
    created_at: "2026-06-25T08:59:00.000Z",
  };
}

async function fulfillNotifications(route: Route, rows: NotificationRow[]) {
  const method = route.request().method();
  if (method === "HEAD") {
    await route.fulfill({
      status: 200,
      headers: {
        "content-range":
          "0-" + Math.max(rows.length - 1, 0) + "/" + rows.length,
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
    body: JSON.stringify(rows),
  });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openNotifications(page: Page) {
  const notificationBellReady = page.waitForResponse(
    (response) =>
      response.request().method() === "HEAD" &&
      response.url().includes("/rest/v1/user_notifications"),
    { timeout: 15_000 },
  );
  await page.goto("/settings/notifications", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await notificationBellReady;
  await page.waitForLoadState("networkidle");
  await openNotificationPopover(page);
}

async function openNotificationPopover(page: Page) {
  await expect(page.locator(".app-notification-bell")).toBeVisible({
    timeout: 15_000,
  });
  const bell = page.locator(".app-notification-bell");
  await expect(bell).toBeEnabled();
  await bell.click();
  await expect(page.locator(".app-notification-panel:visible")).toBeVisible({
    timeout: 15_000,
  });
}

function getInvitationModal(page: Page) {
  return page.locator(".ant-modal").filter({
    has: page.locator(".institution-invitation-modal__code"),
  });
}

test("institution invitation expiry states work in the list and modal", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const errors = collectErrors(page);
  const startedAt = Date.now();
  let rows = [
    makeInvitationRow(new Date(startedAt + DAY_MS).toISOString()),
    makeOrdinaryRow(),
  ];

  await page.route(NOTIFICATIONS_ROUTE, (route) =>
    fulfillNotifications(route, rows),
  );
  await openNotifications(page);

  const invitationItem = page
    .locator(".app-notification-panel:visible .app-notification-item")
    .filter({ hasText: "Institution invitation" });
  await expect(invitationItem).toBeVisible();
  await expect(invitationItem).toContainText("D-1");
  const invitationMeta = invitationItem.locator(".app-notification-item__meta");
  await expect(invitationMeta).toHaveCount(1);
  await expect(invitationMeta).toHaveCSS("display", "flex");
  await expect(
    invitationMeta.locator(".app-notification-item__time"),
  ).toHaveCount(1);
  await expect(
    invitationMeta.locator(".app-notification-item__separator"),
  ).toHaveText("·");

  const ordinaryItem = page
    .locator(".app-notification-panel:visible .app-notification-item")
    .filter({ hasText: "Ordinary notice" });
  await expect(ordinaryItem).not.toContainText(/D-1|Expired|만료/);

  await invitationItem
    .getByRole("button")
    .evaluate((button) => (button as HTMLButtonElement).click());
  const invitationModal = getInvitationModal(page);
  await expect(invitationModal).toBeVisible();
  await expect(invitationModal).toContainText(/Expiry date:|만료일:/);

  await invitationModal.locator(".ant-modal-footer button").first().click();
  await expect(invitationModal).toBeHidden();
  rows = [makeInvitationRow(new Date(startedAt - 60_000).toISOString())];
  await openNotificationPopover(page);

  const expiredItem = page
    .locator(".app-notification-panel:visible .app-notification-item")
    .filter({ hasText: "Institution invitation" });
  await expect(expiredItem).toBeVisible();
  await expect(
    expiredItem.locator(".app-notification-item__expiry"),
  ).toHaveClass(/ant-typography-danger/);
  await expect(expiredItem.locator(".app-notification-item__meta")).toHaveCSS(
    "display",
    "flex",
  );

  await expiredItem.getByRole("button").click();
  await expect(invitationModal.locator(".ant-alert-warning")).toBeVisible();
  await expect(
    invitationModal.locator(".ant-modal-footer .ant-btn-primary"),
  ).toBeDisabled();
  await expect(
    invitationModal.locator(
      ".ant-modal-footer .ant-btn:not(.ant-btn-primary):not(.ant-btn-dangerous)",
    ),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("expired institution invitation is labeled and cannot be accepted", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const errors = collectErrors(page);
  const rows = [makeInvitationRow(new Date(Date.now() - 60_000).toISOString())];

  await page.route(NOTIFICATIONS_ROUTE, (route) =>
    fulfillNotifications(route, rows),
  );
  await openNotifications(page);

  const invitationItem = page
    .locator(".app-notification-panel:visible .app-notification-item")
    .filter({ hasText: "Institution invitation" });
  await expect(invitationItem).toBeVisible();
  await expect(invitationItem).toContainText(/Expired|만료됨/);

  await invitationItem
    .getByRole("button")
    .evaluate((button) => (button as HTMLButtonElement).click());
  const invitationModal = getInvitationModal(page);
  await expect(invitationModal).toContainText(
    /This invitation has expired\.|만료된 초대입니다\./,
  );
  await expect(
    invitationModal.getByRole("button", { name: /Accept|수락/ }),
  ).toBeDisabled();
  await expect(
    invitationModal.locator(
      ".ant-modal-footer .ant-btn:not(.ant-btn-primary):not(.ant-btn-dangerous)",
    ),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
