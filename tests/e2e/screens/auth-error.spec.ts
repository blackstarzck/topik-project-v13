import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

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

test("X-11 auth error maps expired OTP without exposing raw provider text", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const rawProviderText = "Email link is invalid or has expired";

  await page.goto(
    `/auth/error?reason=otp_expired&email=student%40example.com&error_description=${encodeURIComponent(
      rawProviderText,
    )}`,
    { waitUntil: "networkidle" },
  );

  await expect(page).toHaveURL(/\/auth\/error/);
  await expect(page.getByTestId("auth-error-card-otp_expired")).toBeVisible();
  await expect(page.locator("#auth-error-email")).toHaveValue(
    "student@example.com",
  );
  await expect(page.getByTestId("auth-error-countdown")).toBeVisible();
  await expect(page.getByTestId("auth-error-primary")).toBeDisabled();
  await expect(page.getByTestId("auth-error-secondary")).toBeVisible();
  await expect(page.getByTestId("auth-error-escape")).toBeVisible();
  await expect(page.getByText(rawProviderText)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("X-11 auth error keeps rate-limited retry disabled during countdown", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(
    "/auth/error?reason=over_request_rate_limit&retry_after_seconds=60",
    { waitUntil: "networkidle" },
  );

  await expect(page).toHaveURL(/\/auth\/error/);
  await expect(
    page.getByTestId("auth-error-card-over_request_rate_limit"),
  ).toBeVisible();
  await expect(page.getByTestId("auth-error-countdown")).toBeVisible();
  await expect(page.getByTestId("auth-error-primary")).toBeDisabled();
  await expect(page.getByTestId("auth-error-escape")).toBeVisible();
  await expect(page.locator("#auth-error-email")).toHaveCount(0);

  expect(errors).toEqual([]);
});
