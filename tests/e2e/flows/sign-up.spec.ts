import { expect, test, type Page, type Request } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

const SIGN_UP_ROUTE = /\/auth\/v1\/signup(?:\?|$)/;
const EVIDENCE_DIR = path.join("docs", "qa", "reports", "auth-post-auth-gate");
const VALID_NAME = "홍길동";
const VALID_NATIONALITY_COUNTRY_CODE = "VN";
const VALID_COUNTRY_REGION_LABEL = "베트남";
const VALID_EMAIL = "e2e-signup@example.com";
const VALID_GENDER_LABEL = "여성";
const VALID_PASSWORD = "Password123!";
const VALID_PHONE_NUMBER = "1012345678";

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

async function openSignUp(page: Page, route = "/sign-up") {
  await page.goto(route, { waitUntil: "load" });
  await expect(page).toHaveURL(/\/sign-up/);
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
}

function genderOption(page: Page, label: string) {
  return page.locator(".gender-radio-option").filter({ hasText: label });
}

async function fillSignUpForm(
  page: Page,
  {
    displayName = VALID_NAME,
    countryRegionLabel = VALID_COUNTRY_REGION_LABEL,
    email = VALID_EMAIL,
    genderLabel,
    password = VALID_PASSWORD,
    passwordConfirm = VALID_PASSWORD,
    phoneNumber,
    agreeToTerms = true,
  }: {
    displayName?: string;
    countryRegionLabel?: string;
    email?: string;
    genderLabel?: string;
    password?: string;
    passwordConfirm?: string;
    phoneNumber?: string;
    agreeToTerms?: boolean;
  } = {},
) {
  const displayNameInput = page.locator("#displayName");
  await expect(displayNameInput).toBeVisible();
  await displayNameInput.fill(displayName);
  await displayNameInput.blur();

  const countryRegionSelect = page.getByTestId("country-region-select");
  await expect(countryRegionSelect).toBeVisible();
  await countryRegionSelect.click();
  await page
    .locator(".ant-select-item-option")
    .filter({ hasText: countryRegionLabel })
    .click();

  const emailInput = page.locator("#email");
  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await emailInput.blur();

  const passwordInput = page.locator("#password");
  const passwordConfirmInput = page.locator("#passwordConfirm");
  await expect(passwordInput).toBeVisible();
  await expect(passwordConfirmInput).toBeVisible();
  await passwordInput.fill(password);
  await passwordInput.blur();
  await passwordConfirmInput.fill(passwordConfirm);
  await passwordConfirmInput.blur();

  await expect(genderOption(page, "남성")).toBeVisible();
  await expect(genderOption(page, "여성")).toBeVisible();
  await expect(page.getByText("선택 안 함")).toHaveCount(0);
  await expect(page.locator("#phoneNumber")).toBeVisible();
  await expect(page.getByTestId("phone-country-code-select")).toContainText(
    "+82",
  );
  await expect(
    page.getByText(
      "선택 입력입니다. 입력하는 경우 국가번호를 포함한 국제 형식으로 적어 주세요.",
    ),
  ).toHaveCount(0);
  if (genderLabel) {
    await genderOption(page, genderLabel).click();
  }
  if (phoneNumber) {
    await page.locator("#phoneNumber").fill(phoneNumber);
    await page.locator("#phoneNumber").blur();
  }

  if (agreeToTerms) {
    await expect(page.locator("#terms")).toBeVisible();
    await page.locator("#terms").check();
  }
}

async function clickSubmit(page: Page) {
  await page.locator('button[type="submit"]').click();
}

async function saveEvidenceScreenshot(page: Page, name: string) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(EVIDENCE_DIR, `${name}.png`),
  });
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
          // 새 계정 성공 응답은 방금 만든 email identity를 포함한다.
          identities: [
            {
              created_at: new Date().toISOString(),
              id: "00000000-0000-4000-8000-000000000001",
              identity_data: {
                email: VALID_EMAIL,
                sub: "00000000-0000-4000-8000-000000000001",
              },
              identity_id: "00000000-0000-4000-8000-000000000002",
              last_sign_in_at: new Date().toISOString(),
              provider: "email",
              updated_at: new Date().toISOString(),
              user_id: "00000000-0000-4000-8000-000000000001",
            },
          ],
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

// 이메일 확인이 켜진 프로젝트에서 이미 확인된 계정에 재가입을 시도하면
// Supabase는 에러 대신 identities가 빈 난독화 성공 응답을 돌려준다.
async function mockSignUpExistingEmailObfuscated(
  page: Page,
): Promise<SignUpRequest[]> {
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
          id: "00000000-0000-4000-8000-000000000003",
          identities: [],
          role: "authenticated",
          updated_at: new Date().toISOString(),
          user_metadata: {},
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

async function mockSignUpNoUserSuccess(page: Page): Promise<SignUpRequest[]> {
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
        user: null,
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });

  return requests;
}

async function mockSignUpRateLimited(page: Page): Promise<SignUpRequest[]> {
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
        code: "over_email_send_rate_limit",
        error_code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
      }),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 429,
    });
  });

  return requests;
}

test.describe("A-01 sign-up functional flow", () => {
  test("public sign-up screen starts progressively and keeps alternate paths", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await openSignUp(page);

    await expect(page.getByTestId("auth-language-select")).toHaveCount(0);
    await expect(page.locator(".signup-prompt-links")).toHaveCount(0);
    await expect(page.locator("#displayName")).toBeVisible();
    await expect(page.getByTestId("country-region-select")).toHaveCount(0);
    await expect(page.locator("#email")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveCount(0);
    await expect(page.locator("#terms")).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Google/ })).toBeEnabled();
    await expect(
      page.locator('a[href="/login"]:visible').first(),
    ).toBeVisible();

    await page.locator("#displayName").fill(VALID_NAME);
    await page.locator("#displayName").blur();
    await expect(page.getByTestId("country-region-select")).toBeVisible();
    await expect(genderOption(page, "남성")).toHaveCount(0);
    await expect(genderOption(page, "여성")).toHaveCount(0);
    await expect(page.getByText("선택 안 함")).toHaveCount(0);
    await expect(page.locator("#phoneNumber")).toHaveCount(0);

    const displayNameBox = await page.locator("#displayName").boundingBox();
    const countryRegionBox = await page
      .getByTestId("country-region-select")
      .boundingBox();
    if (!displayNameBox || !countryRegionBox) {
      throw new Error("Could not measure sign-up input heights");
    }
    expect(countryRegionBox.y).toBeGreaterThan(displayNameBox.y);
    expect(
      Math.abs(countryRegionBox.height - displayNameBox.height),
    ).toBeLessThanOrEqual(1);
    await expect(page.locator("#email")).toHaveCount(0);

    await page.getByTestId("country-region-select").click();
    await page
      .locator(".ant-select-item-option")
      .filter({ hasText: VALID_COUNTRY_REGION_LABEL })
      .click();
    const selectedCountryCenterDelta = await page
      .getByTestId("country-region-select")
      .evaluate((select) => {
        const selectedValue = select.querySelector(
          ".ant-select-content > span",
        );
        if (!selectedValue) {
          throw new Error("Could not find selected country value");
        }
        const selectBox = select.getBoundingClientRect();
        const valueBox = selectedValue.getBoundingClientRect();
        return Math.abs(
          valueBox.top +
            valueBox.height / 2 -
            (selectBox.top + selectBox.height / 2),
        );
      });
    expect(selectedCountryCenterDelta).toBeLessThanOrEqual(1);
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");
    const passwordConfirmInput = page.locator("#passwordConfirm");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeFocused();
    await expect(genderOption(page, "남성")).toHaveCount(0);
    await expect(genderOption(page, "여성")).toHaveCount(0);
    await expect(page.locator("#phoneNumber")).toHaveCount(0);

    await emailInput.fill(VALID_EMAIL);
    await expect(passwordInput).toBeVisible();
    await expect(passwordConfirmInput).toBeVisible();
    await expect(emailInput).toBeFocused();
    await expect(genderOption(page, "남성")).toHaveCount(0);
    await expect(genderOption(page, "여성")).toHaveCount(0);
    await expect(page.locator("#phoneNumber")).toHaveCount(0);

    await expect(page.locator("#terms")).toHaveCount(0);
    await passwordInput.fill(VALID_PASSWORD);
    await expect(page.locator("#terms")).toHaveCount(0);
    await passwordConfirmInput.fill(VALID_PASSWORD);
    await expect(genderOption(page, "남성")).toBeVisible();
    await expect(genderOption(page, "여성")).toBeVisible();
    await expect(page.locator("#phoneNumber")).toBeVisible();
    await expect(page.getByTestId("phone-country-code-select")).toContainText(
      "+82",
    );
    await expect(page.locator("#terms")).toBeVisible();
    await expect(passwordConfirmInput).toBeFocused();

    await page.reload({ waitUntil: "networkidle" });
    await fillSignUpForm(page, { agreeToTerms: false });
    await expect(
      page.locator('a[href="/terms"]:visible').first(),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/privacy"]:visible').first(),
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();

    expect(errors).toEqual([]);
  });

  test("valid email sign-up sends auth payload and redirects to verify-email", async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpSuccess(page);

    await openSignUp(page);
    await fillSignUpForm(page);
    await expect(page.getByTestId("password-strength")).toBeVisible();
    await clickSubmit(page);

    await page.waitForURL(
      /\/auth\/verify-email\?email=e2e-signup%40example\.com$/,
    );
    await saveEvidenceScreenshot(
      page,
      `signup-verify-email-${testInfo.project.name}`,
    );

    expect(signUpRequests).toHaveLength(1);
    expect(signUpRequests[0].payload).toMatchObject({
      data: {
        display_name: VALID_NAME,
        nationality_country_code: VALID_NATIONALITY_COUNTRY_CODE,
      },
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
    const redirectTo = new URL(
      signUpRequests[0].url.searchParams.get("redirect_to") ?? "",
    );
    expect(redirectTo.origin).toBe(new URL(page.url()).origin);
    expect(redirectTo.pathname).toBe("/auth/callback");
    expect(redirectTo.searchParams.get("next")).toBe(
      "/auth/post-auth?intent=sign-up",
    );
    expect(errors).toEqual([]);
  });

  test("valid email sign-up can include optional gender and phone metadata", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpSuccess(page);

    await openSignUp(page);
    await fillSignUpForm(page, {
      email: "optional-profile@example.com",
      genderLabel: VALID_GENDER_LABEL,
      phoneNumber: VALID_PHONE_NUMBER,
    });
    await clickSubmit(page);

    await page.waitForURL(
      /\/auth\/verify-email\?email=optional-profile%40example\.com$/,
    );

    expect(signUpRequests).toHaveLength(1);
    expect(signUpRequests[0].payload).toMatchObject({
      data: {
        display_name: VALID_NAME,
        gender: "female",
        nationality_country_code: VALID_NATIONALITY_COUNTRY_CODE,
        phone_number: "821012345678",
      },
      email: "optional-profile@example.com",
      password: VALID_PASSWORD,
    });
    expect(errors).toEqual([]);
  });

  test("valid email sign-up includes an aff code captured from the sign-up URL", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpSuccess(page);

    await page.goto("/sign-up?aff=EXPO2026-BOOTH-A", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/auth\/institution-invite$/);
    await page.locator('a[href="/sign-up"]').click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.locator("#displayName")).toBeVisible();
    await fillSignUpForm(page, { email: "aff-signup@example.com" });
    await clickSubmit(page);

    await page.waitForURL(
      /\/auth\/verify-email\?email=aff-signup%40example\.com$/,
    );

    expect(signUpRequests).toHaveLength(1);
    expect(signUpRequests[0].payload).toMatchObject({
      data: {
        affiliation_code: "EXPO2026-BOOTH-A",
        display_name: VALID_NAME,
        nationality_country_code: VALID_NATIONALITY_COUNTRY_CODE,
      },
      email: "aff-signup@example.com",
      password: VALID_PASSWORD,
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("talkpik:affiliation-code"),
        ),
      )
      .toBeNull();
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
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    expect(blockedNetworkAttempts).toBe(0);

    await page.locator("#terms").check();
    await page.locator("#passwordConfirm").fill("Different123!");
    await page.locator("#passwordConfirm").blur();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    expect(blockedNetworkAttempts).toBe(0);
    expect(errors).toEqual([]);
  });

  test("no-user success-like auth response still reaches verify-email guidance", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpNoUserSuccess(page);

    await openSignUp(page);
    await fillSignUpForm(page, { email: "obfuscated@example.com" });
    await clickSubmit(page);

    await page.waitForURL(
      /\/auth\/verify-email\?email=obfuscated%40example\.com$/,
    );
    await expect(
      page.getByTestId("verify-email-existing-account-actions"),
    ).toBeVisible();
    expect(signUpRequests).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("duplicate email auth error shows explicit duplicate guidance and keeps user on sign-up", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpDuplicateEmail(page);

    await openSignUp(page);
    await fillSignUpForm(page);
    await clickSubmit(page);

    await expect(page.getByTestId("sign-up-safe-guidance")).toBeVisible();
    // 2026-07-03 제안: 중복을 명시하되 raw provider 문구는 노출하지 않는다.
    await expect(
      page.getByText(
        "이 이메일로 가입한 계정이 이미 있어요. 로그인하거나 비밀번호를 재설정해 주세요.",
      ),
    ).toBeVisible();
    await expect(page.getByText("이미 가입된 이메일이에요")).toBeVisible();
    await expect(page.getByText("User already registered")).toHaveCount(0);
    expect(page.url()).not.toContain("duplicate");
    expect(page.url()).not.toContain("exists");
    expect(page.url()).not.toContain("reason");
    expect(page.url()).not.toContain("user_not_found");
    await expect(page).toHaveURL(/\/sign-up/);
    expect(signUpRequests).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("identities-empty obfuscated response shows duplicate guidance instead of verify-email", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpExistingEmailObfuscated(page);

    await openSignUp(page);
    await fillSignUpForm(page, { email: "existing@example.com" });
    await clickSubmit(page);

    await expect(page.getByTestId("sign-up-safe-guidance")).toBeVisible();
    await expect(page.getByText("이미 가입된 이메일이에요")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);

    // 이메일을 고치면 인라인 오류와 안내가 사라진다.
    await page.locator("#email").fill("another@example.com");
    await expect(page.getByTestId("sign-up-safe-guidance")).toHaveCount(0);
    await expect(page.getByText("이미 가입된 이메일이에요")).toHaveCount(0);

    expect(signUpRequests).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("rate-limited signup starts a cooldown and blocks repeat submits", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const signUpRequests = await mockSignUpRateLimited(page);

    await openSignUp(page);
    await page.evaluate(() => {
      window.localStorage.removeItem("talkpik:sign-up:cooldown-until");
    });
    await fillSignUpForm(page, { email: "limited@example.com" });
    await clickSubmit(page);

    await expect(page.getByTestId("sign-up-countdown")).toBeVisible();
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText("회원가입");
    await expect(page.getByTestId("auth-switch-link-disabled")).toBeVisible();
    await expect(page.getByTestId("auth-switch-link-disabled")).toHaveText(
      "로그인",
    );
    await expect(page.getByTestId("auth-switch-link")).toHaveCount(0);
    await expect
      .poll(() =>
        submit.evaluate(
          (element) => window.getComputedStyle(element).backgroundColor,
        ),
      )
      .not.toBe("rgb(25, 25, 25)");
    await expect
      .poll(() =>
        submit.evaluate((element) => window.getComputedStyle(element).color),
      )
      .not.toBe("rgba(0, 0, 0, 0.25)");

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("sign-up-countdown")).toBeVisible();
    await expect(submit).toHaveCount(0);
    await expect(page.getByTestId("auth-switch-link-disabled")).toBeVisible();

    await fillSignUpForm(page, { email: "fixed@example.com" });
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText("회원가입");
    await expect(page.locator("#email")).toHaveValue("fixed@example.com");
    await expect
      .poll(() => signUpRequests.length, { message: "signup request count" })
      .toBe(1);
    expect(errors).toEqual([]);
  });
});
