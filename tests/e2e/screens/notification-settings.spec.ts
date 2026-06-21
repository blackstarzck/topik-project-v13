import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

const BOX_SIDES = ["top", "right", "bottom", "left"] as const;

test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(90_000);
});

function collectErrors(
  page: Page,
  options: {
    ignoredConsoleMessages?: RegExp[];
    ignoredResponseUrls?: RegExp[];
  } = {},
): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !options.ignoredConsoleMessages?.some((pattern) =>
        pattern.test(msg.text()),
      )
    ) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  page.on("response", (response) => {
    if (
      options.ignoredResponseUrls?.some((pattern) =>
        pattern.test(response.url()),
      )
    ) {
      return;
    }
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

async function attachRuntimeErrors(testInfo: TestInfo, errors: string[]) {
  await testInfo.attach("runtime-errors.json", {
    body: JSON.stringify(errors, null, 2),
    contentType: "application/json",
  });
}

async function openNotificationDetails(page: Page) {
  const toggle = page.getByTestId("notification-details-toggle");
  const panel = page.getByTestId("notification-detail-panel");
  await expect(toggle).toBeVisible();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await panel.isVisible().catch(() => false)) return;
    await toggle.click();
    await page.waitForTimeout(250);
  }

  await expect(panel).toBeVisible({ timeout: 5_000 });
}

function waitForSettingsWrite(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/notification_settings") &&
      response.request().method() !== "GET" &&
      response.status() < 300,
  );
}

function waitForSettingsRead(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/notification_settings") &&
      response.request().method() === "GET" &&
      response.status() < 300,
    { timeout: 60_000 },
  );
}

async function gotoNotificationsSettings(page: Page) {
  const settingsRead = waitForSettingsRead(page);
  await page.goto("/settings/notifications", {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });
  await settingsRead;
  await expect(page).toHaveURL(/\/settings\/notifications/);
}

function waitForProfilesWrite(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/profiles") &&
      response.request().method() !== "GET" &&
      response.status() < 300,
  );
}

async function expectSaveSuccess(page: Page) {
  await expect(
    page.locator(".ant-message-notice-success").last(),
  ).toContainText("알림 설정이 저장되었습니다.");
}

async function savePrefsAndSettings(page: Page) {
  const prefsWrite = waitForProfilesWrite(page);
  const settingsWrite = waitForSettingsWrite(page);
  await page.getByTestId("notification-save").click();
  await Promise.all([prefsWrite, settingsWrite]);
  await expectSaveSuccess(page);
  await expect(page.getByTestId("notification-save")).toBeDisabled();
}

async function savePrefsOnly(page: Page) {
  const prefsWrite = waitForProfilesWrite(page);
  await page.getByTestId("notification-save").click();
  await prefsWrite;
  await expectSaveSuccess(page);
  await expect(page.getByTestId("notification-save")).toBeDisabled();
}

async function reloadAndWaitForSettings(page: Page) {
  const settingsRead = waitForSettingsRead(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settingsRead;
}

async function setCheckbox(locator: Locator, checked: boolean) {
  if (checked) {
    await locator.check();
  } else {
    await locator.uncheck();
  }
}

async function isSwitchChecked(locator: Locator) {
  return (await locator.getAttribute("aria-checked")) === "true";
}

async function setSwitch(locator: Locator, checked: boolean) {
  await locator.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await isSwitchChecked(locator)) === checked) return;
    await locator.click();
    await expect(locator)
      .toHaveAttribute("aria-checked", String(checked), { timeout: 1_000 })
      .catch(() => undefined);
  }
  await expect(locator).toHaveAttribute("aria-checked", String(checked));
}

function dayTags(page: Page) {
  return page
    .getByTestId("notification-routine-row-days")
    .locator(".ant-tag-checkable");
}

async function readDayStates(page: Page) {
  const tags = dayTags(page);
  const states: boolean[] = [];
  for (let index = 0; index < 7; index += 1) {
    const className = (await tags.nth(index).getAttribute("class")) ?? "";
    states.push(className.includes("ant-tag-checkable-checked"));
  }
  return states;
}

async function setDayStates(page: Page, targetStates: boolean[]) {
  const tags = dayTags(page);
  for (let index = 0; index < targetStates.length; index += 1) {
    const className = (await tags.nth(index).getAttribute("class")) ?? "";
    const checked = className.includes("ant-tag-checkable-checked");
    if (checked !== targetStates[index]) {
      await tags.nth(index).click();
    }
  }
}

test("X-09 notification settings renders preference regions without saving", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);

  await gotoNotificationsSettings(page);
  await expect(page).not.toHaveURL(/\/login/);

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
  await expect(page.getByText(/외부 발송은 준비가 끝난 뒤/)).toBeVisible();

  await openNotificationDetails(page);
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

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test("X-09 notification settings saves channels and persists after reload", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);

  await gotoNotificationsSettings(page);

  const emailChannel = page
    .getByTestId("notification-channel-email")
    .getByRole("checkbox");
  const save = page.getByTestId("notification-save");
  await expect(emailChannel).toBeVisible();
  await expect(save).toBeDisabled();

  const initialEmail = await emailChannel.isChecked();
  const targetEmail = !initialEmail;

  if (targetEmail) {
    await emailChannel.check();
  } else {
    await emailChannel.uncheck();
  }
  await expect(save).toBeEnabled();

  await savePrefsAndSettings(page);
  await page.screenshot({
    path: testInfo.outputPath("notification-save-success.png"),
    fullPage: true,
  });

  await reloadAndWaitForSettings(page);
  const reloadedEmail = page
    .getByTestId("notification-channel-email")
    .getByRole("checkbox");
  await expect(reloadedEmail).toBeVisible();
  if (targetEmail) {
    await expect(reloadedEmail).toBeChecked();
  } else {
    await expect(reloadedEmail).not.toBeChecked();
  }
  await page.screenshot({
    path: testInfo.outputPath("notification-reload-persisted.png"),
    fullPage: true,
  });

  if ((await reloadedEmail.isChecked()) !== initialEmail) {
    await setCheckbox(reloadedEmail, initialEmail);
    await expect(save).toBeEnabled();
    await savePrefsAndSettings(page);
  }

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test("X-09 notification settings saves notification conditions and leaves clean state", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);

  await gotoNotificationsSettings(page);

  const weeklySummary = page
    .getByTestId("notification-type-weekly_summary")
    .getByRole("switch");
  const save = page.getByTestId("notification-save");
  await expect(weeklySummary).toBeVisible();
  await expect(save).toBeDisabled();

  const initialWeeklySummary = await isSwitchChecked(weeklySummary);
  const targetWeeklySummary = !initialWeeklySummary;

  await setSwitch(weeklySummary, targetWeeklySummary);
  await expect(save).toBeEnabled();
  await savePrefsOnly(page);

  await reloadAndWaitForSettings(page);
  const reloadedWeeklySummary = page
    .getByTestId("notification-type-weekly_summary")
    .getByRole("switch");
  if (targetWeeklySummary) {
    await expect(reloadedWeeklySummary).toHaveAttribute("aria-checked", "true");
  } else {
    await expect(reloadedWeeklySummary).toHaveAttribute(
      "aria-checked",
      "false",
    );
  }
  await page.screenshot({
    path: testInfo.outputPath("notification-condition-reload-persisted.png"),
    fullPage: true,
  });

  await setSwitch(reloadedWeeklySummary, initialWeeklySummary);
  await expect(save).toBeEnabled();
  await savePrefsOnly(page);

  let cleanDialogSeen = false;
  page.once("dialog", async (dialog) => {
    cleanDialogSeen = true;
    await dialog.dismiss();
  });
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/dashboard";
    link.id = "notification-e2e-clean-dashboard-link";
    link.textContent = "clean dashboard navigation check";
    link.style.position = "fixed";
    link.style.left = "8px";
    link.style.bottom = "36px";
    document.body.appendChild(link);
  });
  await page.locator("#notification-e2e-clean-dashboard-link").click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(cleanDialogSeen).toBe(false);

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test("X-09 notification settings saves custom reminder days and persists after reload", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);

  await gotoNotificationsSettings(page);

  const save = page.getByTestId("notification-save");
  const inAppChannel = page
    .getByTestId("notification-channel-in_app")
    .getByRole("checkbox");
  const emailChannel = page
    .getByTestId("notification-channel-email")
    .getByRole("checkbox");
  const zaloChannel = page
    .getByTestId("notification-channel-zalo")
    .getByRole("checkbox");
  await expect(dayTags(page).first()).toBeVisible();
  await expect(save).toBeDisabled();

  const initialChannels = {
    inApp: await inAppChannel.isChecked(),
    email: await emailChannel.isChecked(),
    zalo: await zaloChannel.isChecked(),
  };
  const initialDayStates = await readDayStates(page);

  if (
    !initialChannels.inApp &&
    !initialChannels.email &&
    !initialChannels.zalo
  ) {
    await inAppChannel.check();
  }

  await page
    .getByTestId("notification-routine-row-frequency")
    .getByText("매일")
    .click();
  if (await save.isEnabled()) {
    await savePrefsAndSettings(page);
  }

  await page
    .getByTestId("notification-routine-row-frequency")
    .getByText("사용자 지정")
    .click();
  await expect(save).toBeEnabled();
  await savePrefsAndSettings(page);

  await reloadAndWaitForSettings(page);
  expect(await readDayStates(page)).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  await page.screenshot({
    path: testInfo.outputPath("notification-custom-days-reload-persisted.png"),
    fullPage: true,
  });

  await setDayStates(page, initialDayStates);
  await setCheckbox(
    page.getByTestId("notification-channel-in_app").getByRole("checkbox"),
    initialChannels.inApp,
  );
  await setCheckbox(
    page.getByTestId("notification-channel-email").getByRole("checkbox"),
    initialChannels.email,
  );
  await setCheckbox(
    page.getByTestId("notification-channel-zalo").getByRole("checkbox"),
    initialChannels.zalo,
  );
  if (await save.isEnabled()) {
    await savePrefsAndSettings(page);
  }

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test("X-09 notification settings blocks internal navigation while dirty", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);

  await gotoNotificationsSettings(page);

  const weeklySummary = page
    .getByTestId("notification-type-weekly_summary")
    .getByRole("switch");
  await expect(weeklySummary).toBeVisible();
  await setSwitch(weeklySummary, !(await isSwitchChecked(weeklySummary)));
  await expect(page.getByTestId("notification-save")).toBeEnabled();

  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/dashboard";
    link.id = "notification-e2e-dashboard-link";
    link.textContent = "dashboard navigation check";
    link.style.position = "fixed";
    link.style.left = "8px";
    link.style.bottom = "8px";
    document.body.appendChild(link);
  });

  let dismissedDialogSeen = false;
  page.once("dialog", async (dialog) => {
    dismissedDialogSeen = true;
    expect(dialog.message()).toContain("저장하지 않은 변경사항");
    await dialog.dismiss();
  });
  await page.locator("#notification-e2e-dashboard-link").click();
  await expect
    .poll(() => dismissedDialogSeen, { message: "dismiss dialog was shown" })
    .toBe(true);
  await expect(page).toHaveURL(/\/settings\/notifications/);
  await page.screenshot({
    path: testInfo.outputPath("notification-leave-dismissed.png"),
    fullPage: true,
  });

  let acceptedDialogSeen = false;
  page.once("dialog", async (dialog) => {
    acceptedDialogSeen = true;
    expect(dialog.message()).toContain("저장하지 않은 변경사항");
    await dialog.accept();
  });
  await page.locator("#notification-e2e-dashboard-link").click();
  await expect
    .poll(() => acceptedDialogSeen, { message: "accept dialog was shown" })
    .toBe(true);
  await expect(page).toHaveURL(/\/dashboard/);

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});

test("X-09 notification settings shows delivery history load failure", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page, {
    ignoredConsoleMessages: [
      /Failed to load resource: the server responded with a status of 500/,
    ],
    ignoredResponseUrls: [/notification_delivery_attempts/],
  });

  await page.route("**/rest/v1/notification_delivery_attempts**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "XX000",
        message: "forced delivery history failure",
        details: null,
        hint: null,
      }),
    }),
  );

  await gotoNotificationsSettings(page);
  await openNotificationDetails(page);

  const historyCard = page.getByTestId("notification-history-card");
  await expect(
    historyCard.getByText("발송 이력을 불러오지 못했어요"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    historyCard.getByText("아직 발송된 알림이 없습니다."),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("notification-history-load-error.png"),
    fullPage: true,
  });

  await attachRuntimeErrors(testInfo, errors);
  expect(errors).toEqual([]);
});
