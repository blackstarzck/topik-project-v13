import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("anonymous landing", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    // Pin Korean so anonymous landing copy assertions match (Playwright's
    // default en-US would otherwise render "Log in" instead of "로그인").
    locale: "ko-KR",
    extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
  });

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
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
});

test("ready authenticated landing routes primary CTAs to dashboard", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('header a[href="/dashboard"]')).toContainText(
    "대시보드로 이동",
  );
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
