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

test("X-14 privacy page exposes placeholder policy scope and related links", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/privacy", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByTestId("privacy-card")).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByTestId("privacy-intro")).toBeVisible();
  await expect(page.getByTestId("privacy-summary")).toBeVisible();
  await expect(page.getByTestId("privacy-update")).toBeVisible();
  await expect(page.getByTestId("privacy-related-links")).toBeVisible();
  await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
  await expect(page.locator('a[href="/sign-up"]').first()).toBeVisible();
  await expect(page.locator('a[href="/"]').first()).toBeVisible();

  expect(errors).toEqual([]);
});
