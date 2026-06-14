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

  const response = await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");

  await expect(page).toHaveURL(/\/auth\/verify-email/);
  await expect(
    page.getByRole("heading", { name: "인증 메일을 보냈어요" }),
  ).toBeVisible();
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
  const redirectTo = new URL(
    resendRequests[0].url.searchParams.get("redirect_to") ?? "",
  );
  expect(redirectTo.origin).toBe(new URL(page.url()).origin);
  expect(redirectTo.pathname).toBe("/auth/callback");
  expect(redirectTo.searchParams.get("next")).toBe("/onboarding/learning-goal");

  await expect(page.getByTestId("verify-email-countdown")).toBeVisible();
  await expect(page.locator("#verify-email-input")).toBeDisabled();
  await expect(resend).toBeDisabled();

  expect(errors).toEqual([]);
});

test("X-12 verify email blocks empty resend without a network request", async ({
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

  await page.locator("#verify-email-input").fill("");
  await page.getByTestId("verify-email-resend").click();

  await expect(page.getByText("이메일을 입력해주세요.")).toBeVisible();
  expect(resendRequests).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("X-12 verify email clickable actions navigate to the expected destinations", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );

  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("verify-email-open-inbox").click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/mail\.google\.com/);
  await popup.close();

  await page.getByTestId("verify-email-login").click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );
  await page.getByTestId("verify-email-password-reset").click();
  await expect(page).toHaveURL(/\/password-reset$/);

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );
  await page
    .getByRole("link", { name: "다른 이메일로 가입하기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );
  await page.getByRole("link", { name: "로그인 페이지로" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );
  await page
    .getByRole("link", { name: "다른 이메일로 가입", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);

  await page.goto(
    `/auth/verify-email?email=${encodeURIComponent(VERIFY_EMAIL)}`,
    { waitUntil: "networkidle" },
  );
  await page.getByRole("link", { name: "홈으로" }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors).toEqual([]);
});

test("X-12 verify email hides direct inbox link for unknown mail domains", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/auth/verify-email?email=learner%40example.org", {
    waitUntil: "networkidle",
  });

  await expect(page.getByTestId("verify-email-open-inbox")).toHaveCount(0);
  expect(errors).toEqual([]);
});
