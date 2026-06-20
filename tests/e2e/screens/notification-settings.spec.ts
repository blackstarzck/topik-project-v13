import { expect, test, type Locator, type Page } from "@playwright/test";

const BOX_SIDES = ["top", "right", "bottom", "left"] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function expectZeroBorder(locator: Locator) {
  for (const side of BOX_SIDES) {
    await expect(locator).toHaveCSS(`border-${side}-width`, "0px");
  }
}

async function expectZeroPadding(locator: Locator) {
  for (const side of BOX_SIDES) {
    await expect(locator).toHaveCSS(`padding-${side}`, "0px");
  }
}

async function expectAllFontSize(locator: Locator, fontSize: string) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(locator.nth(index)).toHaveCSS("font-size", fontSize);
  }
}

test("X-09 notification settings renders preference regions without saving", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/notifications", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/notifications/);

  await expect(page.getByRole("heading", { name: "알림 설정" })).toBeVisible();
  await expect(page.getByText(/중요한 알림은 놓치지 않고/)).toBeVisible();
  await expect(page.getByTestId("notification-settings-form")).toBeVisible();
  await expect(page.getByTestId("notification-redesign-shell")).toBeVisible();
  await expect(page.getByTestId("notification-routine-card")).toBeVisible();
  await expect(page.getByTestId("notification-channel-card")).toBeVisible();
  await expect(page.getByTestId("notification-condition-card")).toBeVisible();
  await expect(
    page.getByTestId("notification-routine-row-frequency"),
  ).toBeVisible();
  await expect(page.getByTestId("notification-channel-in_app")).toBeVisible();

  for (const testId of [
    "notification-routine-card",
    "notification-condition-card",
    "notification-channel-card",
  ]) {
    const section = page.getByTestId(testId);
    const head = section.locator(".ant-card-head").first();
    const headTitle = section.locator(".ant-card-head-title").first();
    const body = section.locator(".ant-card-body").first();

    await expectZeroBorder(section);
    await expectZeroPadding(section);
    await expectZeroBorder(head);
    await expectZeroPadding(head);
    await expectZeroPadding(headTitle);
    await expectZeroPadding(body);
  }

  for (const testId of [
    "notification-routine-row-frequency",
    "notification-routine-row-time",
    "notification-routine-row-days",
    "notification-routine-row-timezone",
    "notification-type-weekly_summary",
    "notification-type-feedback_ready",
    "notification-type-study_reminder",
    "notification-channel-in_app",
    "notification-channel-email",
    "notification-channel-zalo",
  ]) {
    await expectZeroBorder(page.getByTestId(testId));
  }

  await expect(
    page.locator(".notification-settings-row-label svg"),
  ).toHaveCount(0);
  await expect(
    page.locator(".notification-settings-type-copy svg"),
  ).toHaveCount(0);
  await expect(
    page.locator(".notification-settings-channel-copy svg"),
  ).toHaveCount(3);

  await expectAllFontSize(page.locator(".app-page-header__subtitle"), "14px");
  await expectAllFontSize(
    page.locator(".notification-settings-section-description"),
    "14px",
  );
  await expectAllFontSize(
    page.locator(".notification-settings-row-hint"),
    "14px",
  );
  await expectAllFontSize(
    page.locator(".notification-settings-type-description"),
    "14px",
  );
  await expectAllFontSize(
    page.locator(
      ".notification-settings-channel-copy .ant-typography-secondary",
    ),
    "14px",
  );
  await expectAllFontSize(
    page.locator(".notification-settings-redesign .ant-alert-description"),
    "14px",
  );
  await expect(page.getByTestId("notification-preview-card")).toHaveCount(0);
  await expect(page.getByTestId("notification-history-card")).toHaveCount(0);
  await expect(page.getByText("도움말")).toHaveCount(0);
  await expect(page.getByText(/실제 알림 발송 연동은 준비 중/)).toBeVisible();

  await page.getByTestId("notification-details-toggle").click();
  await expect(page.getByTestId("notification-preview-card")).toBeVisible();
  await expect(page.getByTestId("notification-history-card")).toBeVisible();
  await expect(
    page.locator(".notification-settings-detail-title svg"),
  ).toHaveCount(0);
  await expectAllFontSize(
    page.locator(
      ".notification-settings-detail-panel > section > .ant-typography-secondary",
    ),
    "14px",
  );

  const save = page.getByTestId("notification-save");
  await expect(save).toBeDisabled();

  const emailChannel = page
    .getByTestId("notification-channel-email")
    .getByRole("checkbox");
  if (await emailChannel.isChecked()) {
    await emailChannel.uncheck();
  } else {
    await emailChannel.check();
  }
  await expect(save).toBeEnabled();

  expect(errors).toEqual([]);
});
