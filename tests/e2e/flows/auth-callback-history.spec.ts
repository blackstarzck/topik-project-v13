import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

test("authenticated stale OAuth callback revisit returns to the app instead of auth error", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const authCookies = (await page.context().cookies()).filter(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  await page.context().addCookies(
    authCookies.map((cookie) => ({
      ...cookie,
      domain: "localhost",
    })),
  );

  await page.goto(
    "http://localhost:3000/auth/callback?code=used-code&next=/dashboard",
    { waitUntil: "domcontentloaded" },
  );

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("auth-error-card-unknown")).toHaveCount(0);
  expect(errors).toEqual([]);
});
