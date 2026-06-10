import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const RESEND_ROUTE = /\/auth\/v1\/resend(?:\?|$)/;
const VERIFY_EMAIL = "verify.audit@gmail.com";

type ResendRequest = {
  payload: Record<string, unknown>;
  url: URL;
};

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
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-origin": "*",
  };
}

function readJsonPayload(request: Request): Record<string, unknown> {
  const raw = request.postData();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

async function mockVerifyEmailResend(page: Page): Promise<ResendRequest[]> {
  const requests: ResendRequest[] = [];

  await page.route(RESEND_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    requests.push({
      payload: readJsonPayload(request),
      url: new URL(request.url()),
    });

    await route.fulfill({
      body: "{}",
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });

  return requests;
}

test("X-12 verify email resends through intercepted signup email and starts cooldown", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const resendRequests = await mockVerifyEmailResend(page);

  await page.addInitScript(() => {
    window.localStorage.removeItem("talkpik:verify-email:cooldown-until");
  });

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );

  await expect(page).toHaveURL(/\/auth\/verify-email/);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(VERIFY_EMAIL)).toBeVisible();
  await expect(page.locator("#verify-email-input")).toHaveValue(VERIFY_EMAIL);
  await expect(page.getByTestId("verify-email-help")).toBeVisible();
  await expect(page.getByTestId("verify-email-open-inbox")).toBeVisible();

  const resend = page.getByTestId("verify-email-resend");
  await expect(resend).toBeEnabled();
  await resend.click();

  await expect
    .poll(() => resendRequests.length, { message: "resend request count" })
    .toBe(1);
  expect(resendRequests[0].payload).toMatchObject({
    email: VERIFY_EMAIL,
    type: "signup",
  });
  expect(resendRequests[0].url.searchParams.get("redirect_to") ?? "").toContain(
    "/auth/callback?next=/onboarding/learning-goal",
  );

  await expect(page.getByTestId("verify-email-countdown")).toBeVisible();
  await expect(page.locator("#verify-email-input")).toBeDisabled();
  await expect(resend).toBeDisabled();

  expect(errors).toEqual([]);
});
