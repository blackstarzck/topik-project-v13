import { expect, test, type Page } from "@playwright/test";

test.use({
  storageState: { cookies: [], origins: [] },
  // Anonymous pages negotiate locale from Accept-Language; pin Korean so the
  // Korean-copy assertions below match (see auth-error.spec.ts).
  locale: "ko-KR",
  extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function topOf(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!.y;
}

test.describe("A-01/A-02 auth page switch", () => {
  test("right panel account link switches between login and sign-up forms", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "다시 오신 걸 환영해요" }),
    ).toBeVisible();
    await expect(page.locator("#displayName")).toHaveCount(0);

    await page
      .locator('.signup-prompt-account-link a[href="/sign-up"]')
      .click();
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
    await expect(page.locator("#displayName")).toBeVisible();
    await expect(page.locator("#passwordConfirm")).toHaveCount(0);

    await page.locator("#displayName").fill("QA User");
    await page.locator("#displayName").blur();
    await expect(page.getByTestId("country-region-select")).toBeVisible();
    await expect(page.locator("#passwordConfirm")).toHaveCount(0);

    await page.locator('.signup-prompt-account-link a[href="/login"]').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "다시 오신 걸 환영해요" }),
    ).toBeVisible();
    await expect(page.locator("#displayName")).toHaveCount(0);
    await expect(page.locator("#passwordConfirm")).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("keeps the login panel anchored when switching login methods", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto("/login", { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", {
      name: "다시 오신 걸 환영해요",
    });
    const actionPanel = page.locator(".auth-login-action-panel");
    const googleButton = page.getByRole("button", { name: "Google로 로그인" });

    await expect(heading).toBeVisible();
    const passwordHeadingTop = await topOf(heading);
    const passwordActionTop = await topOf(actionPanel);
    const passwordGoogleTop = await topOf(googleButton);

    await page.getByText("매직링크 로그인").click();
    await expect(
      page.getByRole("button", { name: "로그인 링크 받기" }),
    ).toBeVisible();

    const magicHeadingTop = await topOf(heading);
    const magicActionTop = await topOf(actionPanel);
    const magicGoogleTop = await topOf(googleButton);

    expect(Math.abs(magicHeadingTop - passwordHeadingTop)).toBeLessThanOrEqual(
      2,
    );
    expect(Math.abs(magicActionTop - passwordActionTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(magicGoogleTop - passwordGoogleTop)).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test("shows withdrawn account reason as a message", async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto("/login?reason=withdrawn", { waitUntil: "networkidle" });

    const withdrawnMessage = page.locator(".ant-message-notice").filter({
      hasText:
        "탈퇴 처리된 계정이에요. 탈퇴 후 30일 이내에는 고객센터를 통해 복구를 요청할 수 있어요.",
    });
    await expect(withdrawnMessage).toBeVisible();
    await expect(page.getByTestId("login-session-notice")).toHaveCount(0);
    await expect(page.locator(".ant-notification-notice")).toHaveCount(0);

    const messageBox = await withdrawnMessage.boundingBox();
    const viewport = page.viewportSize();
    expect(messageBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(messageBox!.x).toBeGreaterThanOrEqual(0);
    expect(messageBox!.x + messageBox!.width).toBeLessThanOrEqual(
      viewport!.width + 1,
    );
    expect(messageBox!.y).toBeLessThan(140);

    expect(errors).toEqual([]);
  });

  test("anonymous auth pages hide secondary settings and hero links", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByTestId("auth-language-select")).toHaveCount(0);
    await expect(page.locator(".signup-prompt-links")).toHaveCount(0);
    await expect(page.locator('a[href="/privacy"]:visible')).toHaveCount(0);
    await expect(page.locator('a[href="/terms"]:visible')).toHaveCount(0);

    await page.goto("/sign-up", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "회원가입" })).toBeVisible();
    await expect(page.getByTestId("auth-language-select")).toHaveCount(0);
    await expect(page.locator(".signup-prompt-links")).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
