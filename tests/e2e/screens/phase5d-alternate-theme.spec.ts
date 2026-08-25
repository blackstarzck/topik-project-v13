import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  PHASE5D_ALTERNATE_THEME_MARKER,
  phase5dAlternateTheme,
} from "../fixtures/phase5d-alternate-theme";

const AUTH_READ_ONLY = process.env.PLAYWRIGHT_AUTH_READ_ONLY === "1";
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FONT_SIZE_VARS = [
  "--app-font-size-caption",
  "--app-font-size-body",
  "--app-font-size-body-lg",
  "--app-font-size-subheading",
  "--app-font-size-heading-sm",
  "--app-font-size-heading",
  "--app-font-size-heading-lg",
  "--app-font-size-display-sm",
  "--app-font-size-display",
] as const;

test.skip(
  !AUTH_READ_ONLY,
  "Phase 5D alternate-theme coverage requires PLAYWRIGHT_AUTH_READ_ONLY=1.",
);

function safeRequestLabel(method: string, rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${method} ${url.origin}${url.pathname}`;
  } catch {
    return `${method} [unparseable-url]`;
  }
}

async function expectWithinViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth - document.documentElement.clientWidth,
        document:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      })),
    )
    .toEqual({ body: 0, document: 0 });
}

async function closeSessionOnlyReminder(page: Page) {
  const sessionOnlyReminderClose = page.locator(
    ".ant-modal:visible .ant-modal-close",
  );
  if (await sessionOnlyReminderClose.isVisible().catch(() => false)) {
    await sessionOnlyReminderClose.click();
    await expect(sessionOnlyReminderClose).toBeHidden();
  }
}

async function computedPaint(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
    };
  });
}

async function readFontScale(page: Page) {
  return page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      names.map((name) => [name, style.getPropertyValue(name).trim()]),
    );
  }, FONT_SIZE_VARS);
}

async function injectAlternateTheme(page: Page) {
  const variables = {
    ...phase5dAlternateTheme.appBridgeVars,
    ...phase5dAlternateTheme.antdCssVars,
  };

  await page.evaluate(
    ({ marker, vars }) => {
      const declaration = Object.entries(vars)
        .map(([name, value]) => `${name}: ${value} !important;`)
        .join("\n");
      const style = document.createElement("style");
      style.id = marker;
      style.textContent = `:root, body, .css-var-talkpik {\n${declaration}\n}`;
      document.head.append(style);
    },
    { marker: PHASE5D_ALTERNATE_THEME_MARKER, vars: variables },
  );
}

test("authenticated read-only UI survives a browser-only alternate theme", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  const unexpectedWrites: string[] = [];
  let releaseNotificationList: (() => void) | undefined;
  const notificationListGate = new Promise<void>((resolve) => {
    releaseNotificationList = resolve;
  });

  page.on("pageerror", (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      runtimeErrors.push(
        `response: ${response.status()} ${safeRequestLabel(
          response.request().method(),
          response.url(),
        )}`,
      );
    }
  });

  // This is the only request interception seam in the spec. Browser writes are
  // fulfilled locally and fail the test without ever reaching the network.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());

    if (!READ_ONLY_METHODS.has(method)) {
      unexpectedWrites.push(safeRequestLabel(method, request.url()));
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ error: "phase5d_read_only_guard" }),
      });
      return;
    }

    if (
      method === "GET" &&
      url.pathname.endsWith("/rest/v1/notification_settings")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      });
      return;
    }

    if (url.pathname.endsWith("/rest/v1/user_notifications")) {
      if (method === "HEAD") {
        await route.fulfill({
          status: 200,
          headers: { "content-range": "*/0" },
          body: "",
        });
        return;
      }
      if (method === "GET") {
        await notificationListGate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }
    }

    await route.continue();
  });

  await page.goto("/settings/notifications", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/settings\/notifications/);
  await expect(page).not.toHaveURL(/\/login/);

  const form = page.getByTestId("notification-settings-form");
  const selectedChannel = page.getByTestId("notification-channel-in_app");
  const disabledChannel = page.getByTestId("notification-channel-email");
  const save = page.getByTestId("notification-save");
  const heading = page
    .locator(".notification-settings-section-heading")
    .first();
  const secondaryText = page
    .locator(".notification-settings-section-description")
    .first();
  const timezoneRow = page.getByTestId("notification-routine-row-timezone");
  const timezoneSelect = timezoneRow.locator(".ant-select");
  const timezoneCombobox = timezoneRow.getByRole("combobox");
  const timezoneSelection = timezoneSelect.locator(
    ".ant-select-selection-item",
  );

  await expect(form).toBeVisible();
  await closeSessionOnlyReminder(page);
  await expect(selectedChannel).toHaveAttribute("aria-pressed", "true");
  await expect(disabledChannel).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(timezoneSelection).toHaveText("Asia/Seoul");
  await expectNoHorizontalOverflow(page);

  await timezoneCombobox.click();
  const selectPortal = page.locator(".ant-select-dropdown").filter({
    visible: true,
  });
  await expectWithinViewport(selectPortal, page);
  const baselineSelectPaint = await computedPaint(selectPortal);
  await page.keyboard.press("Escape");
  await expect(selectPortal).toBeHidden();
  await expect(timezoneCombobox).toBeFocused();

  const notificationBell = page.locator(".app-notification-bell");
  const notificationListRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === "GET" &&
      url.pathname.endsWith("/rest/v1/user_notifications")
    );
  });
  await notificationBell.click();
  await notificationListRequest;
  const notificationPortal = page.locator(
    ".app-notification-popover.ant-popover:not(.app-system-report-popover)",
  );
  await expectWithinViewport(notificationPortal, page);
  await expect(notificationPortal.locator(".ant-skeleton")).toBeVisible();
  releaseNotificationList?.();
  await expect(notificationPortal.locator(".ant-empty")).toBeVisible();
  await expect(
    notificationPortal.locator(".app-notification-panel__mark-all"),
  ).toBeDisabled();
  await notificationBell.click();
  await expect(notificationPortal).toBeHidden();
  await expect(notificationBell).toBeFocused();

  const baselinePaint = {
    disabled: await computedPaint(disabledChannel),
    heading: await computedPaint(heading),
    selected: await computedPaint(selectedChannel),
    secondary: await computedPaint(secondaryText),
    surface: await computedPaint(page.locator("body")),
  };
  const baselineFontScale = await readFontScale(page);

  await injectAlternateTheme(page);

  await expect(selectedChannel).toHaveAttribute("aria-pressed", "true");
  await expect(disabledChannel).toBeDisabled();
  await expect(save).toBeDisabled();
  await expect(timezoneSelection).toHaveText("Asia/Seoul");

  const themedPaint = {
    disabled: await computedPaint(disabledChannel),
    heading: await computedPaint(heading),
    selected: await computedPaint(selectedChannel),
    secondary: await computedPaint(secondaryText),
    surface: await computedPaint(page.locator("body")),
  };
  const themedFontScale = await readFontScale(page);

  expect(themedPaint.selected.borderColor).not.toBe(
    baselinePaint.selected.borderColor,
  );
  expect(themedPaint.surface.backgroundColor).not.toBe(
    baselinePaint.surface.backgroundColor,
  );
  expect(themedPaint.heading.color).not.toBe(baselinePaint.heading.color);
  expect(themedPaint.secondary.color).not.toBe(baselinePaint.secondary.color);
  expect(themedPaint.disabled.borderColor).not.toBe(
    baselinePaint.disabled.borderColor,
  );
  expect(themedPaint.disabled.borderRadius).not.toBe(
    baselinePaint.disabled.borderRadius,
  );
  expect(themedPaint.heading.fontFamily).not.toBe(
    baselinePaint.heading.fontFamily,
  );
  expect(themedPaint.heading.fontSize).not.toBe(baselinePaint.heading.fontSize);
  expect(themedPaint.selected.borderColor).toBe("rgb(139, 44, 255)");
  expect(themedPaint.surface.backgroundColor).toBe("rgb(216, 255, 244)");
  expect(themedPaint.heading.color).toBe("rgb(36, 16, 79)");
  expect(themedPaint.secondary.color).toBe("rgb(0, 107, 97)");
  expect(themedPaint.disabled.borderColor).toBe("rgb(0, 143, 122)");
  expect(themedPaint.disabled.borderRadius).toBe("19px");
  expect(themedPaint.heading.fontFamily).toContain("Courier New");
  expect(themedPaint.heading.fontSize).toBe("28px");

  for (const name of FONT_SIZE_VARS) {
    expect(themedFontScale[name]).toBe(
      phase5dAlternateTheme.appBridgeVars[name],
    );
    expect(themedFontScale[name]).not.toBe(baselineFontScale[name]);
  }

  await timezoneCombobox.click();
  await expectWithinViewport(selectPortal, page);
  const themedSelectPaint = await computedPaint(selectPortal);
  expect(themedSelectPaint.boxShadow).not.toBe(baselineSelectPaint.boxShadow);
  expect(themedSelectPaint.boxShadow).not.toBe("none");
  await page.keyboard.press("Escape");
  await expect(selectPortal).toBeHidden();
  await expect(timezoneCombobox).toBeFocused();

  await notificationBell.click();
  await expectWithinViewport(notificationPortal, page);
  await expect(notificationPortal.locator(".ant-empty")).toBeVisible();
  await notificationBell.click();
  await expect(notificationPortal).toBeHidden();

  const reportLauncher = page.getByTestId("system-report-launcher");
  await reportLauncher.click();
  const reportPortal = page.locator(".app-system-report-popover.ant-popover");
  await expectWithinViewport(reportPortal, page);
  await expect(page.getByTestId("system-report-form")).toBeVisible();
  await expect(notificationPortal).toBeHidden();
  await reportLauncher.click();
  await expect(reportPortal).toBeHidden();
  await expect(reportLauncher).toBeFocused();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
  expect(unexpectedWrites).toEqual([]);
});
