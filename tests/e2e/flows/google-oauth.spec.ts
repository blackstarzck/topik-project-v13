import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const AUTHORIZE_ROUTE = /\/auth\/v1\/authorize(?:\?|$)/;
const KAKAOTALK_IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.7.0";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function mockAuthorizePage(page: Page) {
  await page.route(AUTHORIZE_ROUTE, async (route) => {
    await route.fulfill({
      body: "<html><body>Google OAuth intercepted</body></html>",
      contentType: "text/html",
      status: 200,
    });
  });
}

async function expectGoogleOAuthStart({
  page,
  route,
  heading,
  intent,
}: {
  page: Page;
  route: string;
  heading: string;
  intent: "login" | "sign-up";
}) {
  const errors = collectErrors(page);
  await mockAuthorizePage(page);

  await page.goto(route, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  const appOrigin = new URL(page.url()).origin;

  const requestPromise = page.waitForRequest(AUTHORIZE_ROUTE);
  await page.getByRole("button", { name: /Google/ }).click();
  const request = await requestPromise;

  const url = new URL(request.url());
  expect(url.pathname).toBe("/auth/v1/authorize");
  expect(url.searchParams.get("provider")).toBe("google");

  const redirectTo = url.searchParams.get("redirect_to");
  expect(redirectTo).toBeTruthy();

  const callbackUrl = new URL(redirectTo ?? "");
  expect(callbackUrl.origin).toBe(appOrigin);
  expect(callbackUrl.pathname).toBe("/auth/callback");
  expect(callbackUrl.searchParams.get("next")).toBe(
    intent === "sign-up"
      ? "/auth/claim-affiliation?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up"
      : `/auth/post-auth?intent=${intent}`,
  );
  expect(errors).toEqual([]);
}

test.describe("Google OAuth entry", () => {
  test("login starts Supabase Google OAuth with post-auth redirect", async ({
    page,
  }) => {
    await expectGoogleOAuthStart({
      page,
      route: "/login",
      heading: "다시 오신 걸 환영해요",
      intent: "login",
    });
  });

  test("sign-up starts Supabase Google OAuth with post-auth redirect", async ({
    page,
  }) => {
    await expectGoogleOAuthStart({
      page,
      route: "/sign-up",
      heading: "회원가입",
      intent: "sign-up",
    });
  });
});

test.describe("Google OAuth embedded browser guard", () => {
  test.use({ userAgent: KAKAOTALK_IOS_USER_AGENT });

  test("login shows external-browser guidance in KakaoTalk without starting OAuth", async ({
    page,
  }) => {
    let authorizeRequests = 0;
    await page.route(AUTHORIZE_ROUTE, async (route) => {
      authorizeRequests += 1;
      await route.abort();
    });

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Google/ }).click();

    await expect(page.getByTestId("oauth-browser-warning")).toBeVisible();
    await expect(page.getByTestId("oauth-browser-warning")).toContainText(
      "카카오톡 안에서는 Google 로그인이 막힐 수 있어요",
    );
    expect(authorizeRequests).toBe(0);
  });
});
