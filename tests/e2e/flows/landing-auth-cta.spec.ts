import { expect, test, type Page, type Request } from "@playwright/test";

const SIGN_UP_ROUTE = /\/auth\/v1\/signup(?:\?|$)/;
const VALID_NAME = "이민수";
const VALID_COUNTRY_REGION_LABEL = "베트남";
const VALID_NATIONALITY_COUNTRY_CODE = "VN";
const VALID_EMAIL = "landing-aff-signup@example.com";
const VALID_PASSWORD = "Password123!";

type SignUpRequest = {
  payload: Record<string, unknown>;
};

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
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

async function mockSignUpSuccess(page: Page): Promise<SignUpRequest[]> {
  const requests: SignUpRequest[] = [];

  await page.route(SIGN_UP_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    requests.push({
      payload: readJsonPayload(request),
    });

    await route.fulfill({
      body: JSON.stringify({
        session: null,
        user: {
          app_metadata: { provider: "email", providers: ["email"] },
          aud: "authenticated",
          confirmation_sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          email: VALID_EMAIL,
          id: "00000000-0000-4000-8000-000000000011",
          identities: [],
          role: "authenticated",
          updated_at: new Date().toISOString(),
          user_metadata: {
            display_name: VALID_NAME,
            nationality_country_code: VALID_NATIONALITY_COUNTRY_CODE,
          },
        },
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });

  return requests;
}

async function fillSignUpForm(page: Page) {
  await page.locator("#displayName").fill(VALID_NAME);
  await page.locator("#displayName").blur();

  await page.getByTestId("country-region-select").click();
  await page
    .locator(".ant-select-item-option")
    .filter({ hasText: VALID_COUNTRY_REGION_LABEL })
    .click();

  await page.locator("#email").fill(VALID_EMAIL);
  await page.locator("#email").blur();
  await page.locator("#password").fill(VALID_PASSWORD);
  await page.locator("#password").blur();
  await page.locator("#passwordConfirm").fill(VALID_PASSWORD);
  await page.locator("#passwordConfirm").blur();
  await page.locator("#terms").check();
}

test.describe("anonymous landing", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("keeps login in GNB and free start in the hero", async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.locator('header a[href="/login"]')).toContainText(
      "로그인",
    );
    await expect(page.locator('header a[href="/sign-up"]')).toHaveCount(0);
    await expect(
      page.locator(".landing-hero button").filter({ hasText: "무료 시작" }),
    ).toHaveCount(1);
    await expect(
      page.locator(".landing-hero button").filter({ hasText: "로그인" }),
    ).toHaveCount(0);
    await expect.poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });

  test("keeps aff captured from landing through CTA into email sign-up", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpSuccess(page);

    await page.goto("/?aff=EXPO2026-BOOTH-A", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("talkpik:affiliation-code"),
        ),
      )
      .toContain("EXPO2026-BOOTH-A");

    await page
      .locator(".landing-hero button")
      .filter({ hasText: "무료 시작" })
      .click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await fillSignUpForm(page);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(
      /\/auth\/verify-email\?email=landing-aff-signup%40example\.com$/,
    );

    expect(signUpRequests).toHaveLength(1);
    expect(signUpRequests[0].payload).toMatchObject({
      data: {
        affiliation_code: "EXPO2026-BOOTH-A",
        display_name: VALID_NAME,
        nationality_country_code: VALID_NATIONALITY_COUNTRY_CODE,
      },
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
    expect(errors).toEqual([]);
  });
});

test("ready authenticated landing routes primary CTAs to dashboard", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.locator('header a[href="/dashboard"]'),
  ).toContainText("대시보드로 이동");
  await expect(page.locator('a[href="/sign-up"]')).toHaveCount(0);
  await expect(page.locator('a[href="/login"]')).toHaveCount(0);
  await expect(
    page.locator(".landing-hero button").filter({ hasText: "대시보드로 이동" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".landing-layout-motion-root a")
      .filter({ hasText: "대시보드로 이동" })
      .first(),
  ).toHaveAttribute("href", "/dashboard");
  expect(errors).toEqual([]);
});
