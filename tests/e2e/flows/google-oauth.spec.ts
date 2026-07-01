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
      body: "<html><body>OAuth intercepted</body></html>",
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
  buttonName = /Google/,
}: {
  page: Page;
  route: string;
  heading?: string | RegExp;
  intent: "login" | "sign-up";
  buttonName?: string | RegExp;
}) {
  const errors = collectErrors(page);
  await mockAuthorizePage(page);

  await page.goto(route, { waitUntil: "networkidle" });
  if (heading) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  const appOrigin = new URL(page.url()).origin;

  const requestPromise = page.waitForRequest(AUTHORIZE_ROUTE);
  const oauthButton = page.getByRole("button", { name: buttonName });
  await expect(oauthButton).toBeVisible();
  await oauthButton.click();
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
      ? "/auth/institution-invite?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up"
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
      heading: /다시 오신 걸 환영해요|Welcome back/,
      intent: "login",
    });
  });

  test("sign-up starts Supabase Google OAuth with post-auth redirect", async ({
    page,
  }) => {
    await expectGoogleOAuthStart({
      page,
      route: "/sign-up",
      heading: /회원가입|Sign up/,
      intent: "sign-up",
    });
  });
});

test.describe("Google OAuth KakaoTalk browser entry", () => {
  test.use({ userAgent: KAKAOTALK_IOS_USER_AGENT });

  test("login shows external-browser guidance instead of starting Google OAuth from KakaoTalk", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await mockAuthorizePage(page);

    await page.goto("/login", { waitUntil: "networkidle" });
    const requestPromise = page
      .waitForRequest(AUTHORIZE_ROUTE, { timeout: 1_000 })
      .then(() => true)
      .catch(() => false);

    await page.getByRole("button", { name: /Google/ }).click();

    await expect(page.getByTestId("oauth-browser-warning")).toBeVisible();
    expect(await requestPromise).toBe(false);
    expect(errors).toEqual([]);
  });

  test("login does not render Kakao OAuth entry from KakaoTalk", async ({
    page,
  }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    await expect(page.getByRole("button", { name: /Kakao|카카오/ })).toHaveCount(
      0,
    );
  });
});
