import { expect, test, type Page } from "@playwright/test";

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

test("X-09 notification settings renders preference regions without saving", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/notifications", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/notifications/);

  await expect(page.getByRole("heading", { name: "알림 설정" })).toBeVisible();
  await expect(page.getByTestId("notification-settings-form")).toBeVisible();
  await expect(page.getByTestId("notification-channel-card")).toBeVisible();
  await expect(page.getByTestId("notification-condition-card")).toBeVisible();
  await expect(page.getByTestId("notification-preview-card")).toBeVisible();
  await expect(page.getByTestId("notification-history-card")).toBeVisible();
  await expect(page.getByText(/실제 알림 발송 연동은 준비 중/)).toBeVisible();

  const save = page.getByTestId("notification-save");
  await expect(save).toBeDisabled();

  const emailChannel = page.getByRole("checkbox", { name: "이메일 알림 받기" });
  if (await emailChannel.isChecked()) {
    await emailChannel.uncheck();
  } else {
    await emailChannel.check();
  }
  await expect(save).toBeEnabled();

  expect(errors).toEqual([]);
});
