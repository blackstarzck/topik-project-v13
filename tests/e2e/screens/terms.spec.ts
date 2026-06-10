import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

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

test("X-13 terms page exposes placeholder legal notice and escape links", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/terms", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/terms/);
  await expect(page.getByTestId("terms-card")).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByTestId("terms-intro")).toBeVisible();
  await expect(page.getByTestId("terms-placeholder-notice")).toBeVisible();
  await expect(page.getByTestId("terms-summary")).toBeVisible();
  await expect(page.getByTestId("terms-contact")).toBeVisible();
  await expect(page.getByTestId("terms-shortcuts")).toBeVisible();
  await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
  await expect(page.locator('a[href="/sign-up"]').first()).toBeVisible();
  await expect(page.locator('a[href="/"]').first()).toBeVisible();

  expect(errors).toEqual([]);
});
