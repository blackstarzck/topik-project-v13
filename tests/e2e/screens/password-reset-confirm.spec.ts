import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const UPDATE_USER_ROUTE = /\/auth\/v1\/user(?:\?|$)/;
const VALID_PASSWORD = "AuditPass123!";

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

function corsHeaders(request: Request) {
  return {
    "access-control-allow-headers":
      request.headers()["access-control-request-headers"] ??
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "PUT, OPTIONS",
    "access-control-allow-origin": "*",
  };
}

async function mockPasswordUpdateFailure(page: Page) {
  let calls = 0;

  await page.route(UPDATE_USER_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    calls += 1;
    await route.fulfill({
      body: JSON.stringify({
        code: "otp_expired",
        error: "invalid_grant",
        error_description: "Synthetic expired recovery session for audit.",
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 401,
    });
  });

  return () => calls;
}

test("X-16 password reset confirm renders and gives a recovery path when update fails", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const updateCalls = await mockPasswordUpdateFailure(page);

  await page.goto("/password-reset/confirm", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/password-reset\/confirm/);
  await expect(page.getByTestId("password-reset-confirm-card")).toBeVisible();
  await expect(page.getByTestId("password-reset-confirm-form")).toBeVisible();
  await expect(page.getByTestId("password-reset-confirm-guide")).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByTestId("password-reset-confirm-login")).toBeVisible();

  await page.locator("#password-reset-confirm-password").fill(VALID_PASSWORD);
  await page
    .locator("#password-reset-confirm-password-confirm")
    .fill(VALID_PASSWORD);

  await expect(page.getByTestId("password-strength")).toBeVisible();

  await page.getByTestId("password-reset-confirm-submit").click();

  await expect(page.getByTestId("password-reset-confirm-error")).toBeVisible();
  await expect(
    page.getByTestId("password-reset-confirm-request-link"),
  ).toHaveAttribute("href", "/password-reset");
  await expect(page.getByText("Synthetic expired recovery session")).toHaveCount(
    0,
  );

  expect(updateCalls()).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
