import { expect, test, type Page, type Request } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const USER_ROUTE = /\/auth\/v1\/user(?:\?|$)/;
const RAW_PROVIDER_DESCRIPTION = "Raw provider secret should stay hidden";

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

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeAuditJwt(): string {
  return [
    base64UrlJson({ alg: "HS256", typ: "JWT" }),
    base64UrlJson({
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
      sub: "audit-user",
    }),
    Buffer.from("sig").toString("base64url"),
  ].join(".");
}

function corsHeaders(request: Request) {
  return {
    "access-control-allow-headers":
      request.headers()["access-control-request-headers"] ??
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": "*",
  };
}

function syntheticUserBody() {
  const now = new Date().toISOString();
  return JSON.stringify({
    user: {
      id: "audit-user",
      aud: "authenticated",
      role: "authenticated",
      email: "fragment-audit@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: now,
      updated_at: now,
    },
  });
}

test("X-17 missing fragment redirects to the canonical unknown auth error", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/auth/callback-fragment", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth\/error\?reason=unknown$/, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("auth-error-card-unknown")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  expect(errors).toEqual([]);
});

test("X-17 error fragment maps to a canonical reason and hides raw provider copy", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto(
    `/auth/callback-fragment#error=access_denied&error_code=otp_expired&error_description=${encodeURIComponent(RAW_PROVIDER_DESCRIPTION)}`,
    { waitUntil: "domcontentloaded" },
  );

  await expect(page).toHaveURL(/\/auth\/error\?reason=otp_expired$/, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("auth-error-card-otp_expired")).toBeVisible();
  await expect(page.getByText(RAW_PROVIDER_DESCRIPTION)).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe("");
  expect(errors).toEqual([]);
});

test("X-17 token fragment sets a browser session and redirects to sanitized next", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const token = makeAuditJwt();
  let userCalls = 0;
  let releaseUser: (() => void) | undefined;
  let resolveUserSeen: (() => void) | undefined;
  const userSeen = new Promise<void>((resolve) => {
    resolveUserSeen = resolve;
  });
  const userRelease = new Promise<void>((resolve) => {
    releaseUser = resolve;
  });

  await page.route(USER_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    userCalls += 1;
    resolveUserSeen?.();
    await userRelease;
    await route.fulfill({
      body: syntheticUserBody(),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });

  await page.goto(
    `/auth/callback-fragment?next=/terms#access_token=${encodeURIComponent(token)}&refresh_token=refresh-audit&token_type=bearer&type=signup`,
    { waitUntil: "domcontentloaded" },
  );

  await userSeen;
  await expect(page.getByTestId("callback-fragment-status")).toBeVisible();
  expect(page.url()).not.toContain("access_token");
  expect(page.url()).not.toContain("refresh_token");
  expect(new URL(page.url()).hash).toBe("");
  releaseUser?.();

  await expect(page).toHaveURL(/\/terms$/, { timeout: 10_000 });
  expect(userCalls).toBe(1);
  expect(page.url()).not.toContain("access_token");
  expect(new URL(page.url()).hash).toBe("");
  expect(errors).toEqual([]);
});

test("X-17 recovery token fragment without next opens password reset confirmation", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const token = makeAuditJwt();

  await page.route(USER_ROUTE, async (route, request) => {
    if (request.method() === "OPTIONS") {
      await route.fulfill({ headers: corsHeaders(request), status: 204 });
      return;
    }

    await route.fulfill({
      body: syntheticUserBody(),
      contentType: "application/json",
      headers: corsHeaders(request),
      status: 200,
    });
  });

  await page.goto(
    `/auth/callback-fragment#access_token=${encodeURIComponent(token)}&refresh_token=refresh-audit&token_type=bearer&type=recovery`,
    { waitUntil: "domcontentloaded" },
  );

  await expect(page).toHaveURL(/\/password-reset\/confirm$/, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("password-reset-confirm-form")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  expect(errors).toEqual([]);
});
