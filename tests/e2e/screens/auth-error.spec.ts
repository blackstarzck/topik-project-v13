import { expect, test, type Page, type Request } from "@playwright/test";

test.use({
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  locale: "ko-KR",
  storageState: { cookies: [], origins: [] },
});

const RESEND_ROUTE = /\/auth\/v1\/resend(?:\?|$)/;

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

async function mockAuthErrorResend(page: Page): Promise<ResendRequest[]> {
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

test("shared AppCard surface has no independent border chrome", async ({
  page,
}) => {
  await page.goto("/auth/error?reason=unknown", { waitUntil: "networkidle" });

  const cardChrome = await page.locator(".app-card").first().evaluate((card) => {
    const cardStyle = window.getComputedStyle(card);
    const body = card.querySelector(".ant-card-body");
    if (!(body instanceof HTMLElement)) {
      throw new Error("expected AppCard body");
    }
    const bodyStyle = window.getComputedStyle(body);

    return {
      bodyBorderBottomLeftRadius: bodyStyle.borderBottomLeftRadius,
      bodyBorderBottomRightRadius: bodyStyle.borderBottomRightRadius,
      bodyBorderBottomWidth: bodyStyle.borderBottomWidth,
      bodyBorderLeftWidth: bodyStyle.borderLeftWidth,
      bodyBorderRightWidth: bodyStyle.borderRightWidth,
      bodyBorderTopLeftRadius: bodyStyle.borderTopLeftRadius,
      bodyBorderTopRightRadius: bodyStyle.borderTopRightRadius,
      bodyBorderTopWidth: bodyStyle.borderTopWidth,
      cardBorderBottomWidth: cardStyle.borderBottomWidth,
      cardBorderLeftWidth: cardStyle.borderLeftWidth,
      cardBorderRightWidth: cardStyle.borderRightWidth,
      cardBorderTopWidth: cardStyle.borderTopWidth,
    };
  });

  expect(cardChrome).toMatchObject({
    bodyBorderBottomLeftRadius: "0px",
    bodyBorderBottomRightRadius: "0px",
    bodyBorderBottomWidth: "0px",
    bodyBorderLeftWidth: "0px",
    bodyBorderRightWidth: "0px",
    bodyBorderTopLeftRadius: "0px",
    bodyBorderTopRightRadius: "0px",
    bodyBorderTopWidth: "0px",
    cardBorderBottomWidth: "0px",
    cardBorderLeftWidth: "0px",
    cardBorderRightWidth: "0px",
    cardBorderTopWidth: "0px",
  });
});

test("X-11 expired OTP enables resend after countdown and secondary login works", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const resendRequests = await mockAuthErrorResend(page);

  await page.goto(
    "/auth/error?reason=otp_expired&email=student%40example.com&retry_after_seconds=1",
    { waitUntil: "networkidle" },
  );

  const primary = page.getByTestId("auth-error-primary");
  await expect(primary).toBeDisabled();
  await expect(primary).toBeEnabled({ timeout: 3000 });
  await primary.click();

  await expect
    .poll(() => resendRequests.length, { message: "auth error resend count" })
    .toBe(1);
  expect(resendRequests[0].payload).toMatchObject({
    email: "student@example.com",
    type: "signup",
  });
  const redirectTo = new URL(
    resendRequests[0].url.searchParams.get("redirect_to") ?? "",
  );
  expect(redirectTo.origin).toBe(new URL(page.url()).origin);
  expect(redirectTo.pathname).toBe("/auth/callback");
  expect(redirectTo.searchParams.get("next")).toBe(
    "/auth/post-auth?intent=sign-up",
  );

  await page.goto(
    "/auth/error?reason=otp_expired&email=student%40example.com",
    {
      waitUntil: "networkidle",
    },
  );
  await page.getByTestId("auth-error-secondary").click();
  await expect(page).toHaveURL(/\/login$/);

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

test("X-11 rate-limited retry navigates to login after countdown", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(
    "/auth/error?reason=over_request_rate_limit&retry_after_seconds=1",
    { waitUntil: "networkidle" },
  );

  const primary = page.getByTestId("auth-error-primary");
  await expect(primary).toBeDisabled();
  await expect(primary).toBeEnabled({ timeout: 3000 });
  await primary.click();
  await expect(page).toHaveURL(/\/login$/);

  expect(errors).toEqual([]);
});

test("X-11 user_not_found stays neutral and its click actions navigate correctly", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(
    "/auth/error?reason=user_not_found&email=deleted%40example.com",
    {
      waitUntil: "networkidle",
    },
  );

  await expect(
    page.getByTestId("auth-error-card-user_not_found"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "이 링크로는 계속할 수 없어요" }),
  ).toBeVisible();
  await expect(page.getByText("deleted@example.com")).toHaveCount(0);
  await expect(page.locator("#auth-error-email")).toHaveCount(0);
  await expect(page.getByText(/계정은 더 이상 존재/)).toHaveCount(0);
  await expect(page.getByText(/계정이 존재/)).toHaveCount(0);

  await page.getByTestId("auth-error-primary").click();
  await expect(page).toHaveURL(/\/sign-up$/);

  await page.goto(
    "/auth/error?reason=user_not_found&email=deleted%40example.com",
    {
      waitUntil: "networkidle",
    },
  );
  await page.getByTestId("auth-error-secondary").click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(
    "/auth/error?reason=user_not_found&email=deleted%40example.com",
    {
      waitUntil: "networkidle",
    },
  );
  const escapeLinks = page.getByTestId("auth-error-escape").getByRole("link");
  await expect(escapeLinks).toHaveCount(1);
  const homeEscapeLink = escapeLinks.first();
  await expect(homeEscapeLink).toBeVisible();
  await expect(homeEscapeLink).toHaveAttribute("href", "/");
  await Promise.all([page.waitForURL(/\/$/), homeEscapeLink.click()]);

  expect(errors).toEqual([]);
});

test("X-11 escape links do not duplicate primary or secondary destinations", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/auth/error?reason=unknown", { waitUntil: "networkidle" });

  const primaryHref = await page
    .getByTestId("auth-error-primary")
    .getAttribute("href");
  const secondaryHref = await page
    .getByTestId("auth-error-secondary")
    .getAttribute("href")
    .catch(() => null);
  const escapeHrefs = await page
    .getByTestId("auth-error-escape")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")).filter(Boolean),
    );

  expect(new Set(escapeHrefs).size).toBe(escapeHrefs.length);
  expect(escapeHrefs).not.toContain(primaryHref);
  if (secondaryHref) expect(escapeHrefs).not.toContain(secondaryHref);

  await page
    .getByTestId("auth-error-escape")
    .getByRole("link", { name: "로그인" })
    .click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/auth/error?reason=unknown", { waitUntil: "networkidle" });
  await page
    .getByTestId("auth-error-escape")
    .getByRole("link", { name: "가입" })
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);

  expect(errors).toEqual([]);
});
