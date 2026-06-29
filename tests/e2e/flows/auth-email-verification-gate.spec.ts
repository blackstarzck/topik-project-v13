import { expect, test, type Page, type Request } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

const SIGN_UP_ROUTE = /\/auth\/v1\/signup(?:\?|$)/;
const EVIDENCE_DIR = path.join(
  "docs",
  "qa",
  "reports",
  "auth-email-verification-gate",
);
const SIGNUP_EMAIL = "e2e-signup@example.com";
const SIGNUP_PASSWORD = "Password123!";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
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

async function saveEvidenceScreenshot(
  page: Page,
  testInfoProjectName: string,
  name: string,
) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${name}-${testInfoProjectName}.png`),
  });
}

async function mockSignUpSuccess(page: Page) {
  await page.route(SIGN_UP_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        session: null,
        user: {
          app_metadata: { provider: "email", providers: ["email"] },
          aud: "authenticated",
          confirmation_sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          email: SIGNUP_EMAIL,
          id: "00000000-0000-4000-8000-000000000091",
          identities: [],
          role: "authenticated",
          updated_at: new Date().toISOString(),
          user_metadata: {
            display_name: "E2E Learner",
            nationality_country_code: "VN",
          },
        },
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });
}

async function completeSignUpForm(page: Page) {
  await page.goto("/sign-up", { waitUntil: "load" });
  await expect(page.locator("#displayName")).toBeVisible();
  await page.locator("#displayName").fill("E2E Learner");

  const countryRegionSelect = page.getByTestId("country-region-select");
  await expect(countryRegionSelect).toBeVisible();
  await countryRegionSelect.click();
  const firstCountryOption = page.locator(".ant-select-item-option").first();
  await expect(firstCountryOption).toBeVisible();
  await firstCountryOption.click();

  await page.locator("#email").fill(SIGNUP_EMAIL);
  await page.locator("#password").fill(SIGNUP_PASSWORD);
  await page.locator("#passwordConfirm").fill(SIGNUP_PASSWORD);
  await page.locator("#terms").check();
  await page.locator('button[type="submit"]').click();
}

test("email sign-up lands on verify-email and leaves screenshot evidence", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-360",
    "signup evidence is captured on the mobile-360 project",
  );
  const errors = collectErrors(page);
  await mockSignUpSuccess(page);

  await completeSignUpForm(page);

  await page.waitForURL(
    /\/auth\/verify-email\?email=e2e-signup%40example\.com$/,
  );
  await expect(page.getByTestId("verify-email-card")).toBeVisible();
  await saveEvidenceScreenshot(
    page,
    testInfo.project.name,
    "verify-email-signup",
  );

  expect(errors).toEqual([]);
});

test("expired OTP stays on auth-error and leaves screenshot evidence", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "expired OTP evidence is captured on the desktop-1280 project",
  );
  const errors = collectErrors(page);

  await page.goto(
    "/auth/error?reason=otp_expired&email=student%40example.com&retry_after_seconds=60",
    { waitUntil: "networkidle" },
  );

  await expect(page).toHaveURL(/\/auth\/error/);
  await expect(page.getByTestId("auth-error-card-otp_expired")).toBeVisible();
  await expect(page.locator("#auth-error-email")).toHaveValue(
    "student@example.com",
  );
  await saveEvidenceScreenshot(
    page,
    testInfo.project.name,
    "auth-error-otp-expired",
  );

  expect(errors).toEqual([]);
});
