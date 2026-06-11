import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const SIGN_UP_ROUTE = /\/auth\/v1\/signup(?:\?|$)/;
const VALID_NAME = "홍길동";
const VALID_EMAIL = "e2e-signup@example.com";
const VALID_PASSWORD = "Password123!";

type SignUpRequest = {
  url: URL;
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

async function openSignUp(page: Page) {
  await page.goto("/sign-up", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
}

async function fillSignUpForm(
  page: Page,
  {
    displayName = VALID_NAME,
    email = VALID_EMAIL,
    password = VALID_PASSWORD,
    passwordConfirm = VALID_PASSWORD,
    agreeToTerms = true,
  }: {
    displayName?: string;
    email?: string;
    password?: string;
    passwordConfirm?: string;
    agreeToTerms?: boolean;
  } = {},
) {
  await page.locator("#displayName").fill(displayName);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#passwordConfirm").fill(passwordConfirm);

  if (agreeToTerms) {
    await page.locator("#terms").check({ force: true });
  }
}

async function clickSubmit(page: Page) {
  await page.locator('button[type="submit"]').click();
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
      url: new URL(request.url()),
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
          id: "00000000-0000-4000-8000-000000000001",
          identities: [],
          role: "authenticated",
          updated_at: new Date().toISOString(),
          user_metadata: { display_name: VALID_NAME },
        },
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });

  return requests;
}

async function mockSignUpDuplicateEmail(page: Page): Promise<SignUpRequest[]> {
  const requests: SignUpRequest[] = [];

  await page.route(SIGN_UP_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    requests.push({
      payload: readJsonPayload(request),
      url: new URL(request.url()),
    });

    await route.fulfill({
      body: JSON.stringify({
        code: "user_already_exists",
        error_code: "user_already_exists",
        message: "User already registered",
        msg: "User already registered",
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 422,
    });
  });

  return requests;
}

test.describe("A-01 sign-up functional flow", () => {
  test("public sign-up screen exposes required links and active Google login state", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await openSignUp(page);

    await expect(
      page.locator('a[href="/terms"]:visible').first(),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/privacy"]:visible').first(),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/login"]:visible').first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Google/ })).toBeEnabled();

    expect(errors).toEqual([]);
  });

  test("valid email sign-up sends auth payload and redirects to verify-email", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpSuccess(page);

    await openSignUp(page);
    await fillSignUpForm(page);
    await expect(page.getByTestId("password-strength")).toBeVisible();
    await clickSubmit(page);

    await page.waitForURL(
      /\/auth\/verify-email\?email=e2e-signup%40example\.com$/,
    );

    expect(signUpRequests).toHaveLength(1);
    expect(signUpRequests[0].payload).toMatchObject({
      data: { display_name: VALID_NAME },
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
    expect(
      signUpRequests[0].url.searchParams.get("redirect_to") ?? "",
    ).toContain("/auth/callback?next=/onboarding/learning-goal");
    expect(errors).toEqual([]);
  });

  test("submit is disabled while all text inputs are empty", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    let blockedNetworkAttempts = 0;
    await page.route(SIGN_UP_ROUTE, async (route) => {
      blockedNetworkAttempts += 1;
      await route.abort();
    });

    await openSignUp(page);

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();

    await page.locator("#terms").check({ force: true });
    await expect(submitButton).toBeDisabled();

    await page.locator("#displayName").fill("a");
    await expect(submitButton).toBeEnabled();

    await page.locator("#displayName").fill("");
    await expect(submitButton).toBeDisabled();
    expect(blockedNetworkAttempts).toBe(0);
    expect(errors).toEqual([]);
  });

  test("client validation blocks sign-up without terms or matching passwords", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    let blockedNetworkAttempts = 0;
    await page.route(SIGN_UP_ROUTE, async (route) => {
      blockedNetworkAttempts += 1;
      await route.abort();
    });

    await openSignUp(page);
    await fillSignUpForm(page, { agreeToTerms: false });
    await clickSubmit(page);

    const termsModal = page
      .locator(".ant-modal-confirm")
      .filter({ hasText: "약관 동의가 필요해요" });
    await expect(termsModal).toBeVisible();
    await expect(
      termsModal.filter({
        hasText:
          "회원가입을 계속하려면 이용약관과 개인정보처리방침에 동의해주세요.",
      }),
    ).toBeVisible();
    expect(blockedNetworkAttempts).toBe(0);

    await termsModal.getByRole("button", { name: "확인" }).click();
    await expect(termsModal).toBeHidden();

    await page.locator("#terms").check({ force: true });
    await page.locator("#passwordConfirm").fill("Different123!");
    await clickSubmit(page);

    await expect(
      page
        .locator(".ant-form-item-explain-error")
        .filter({ hasText: /비밀번호.*일치/ }),
    ).toBeVisible();
    expect(blockedNetworkAttempts).toBe(0);
    expect(errors).toEqual([]);
  });

  test("duplicate email auth error is shown inline and keeps user on sign-up", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpDuplicateEmail(page);

    await openSignUp(page);
    await fillSignUpForm(page);
    await clickSubmit(page);

    await expect(
      page
        .locator(".ant-form-item-explain-error")
        .filter({ hasText: /이미 가입된 이메일/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
    expect(signUpRequests).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
