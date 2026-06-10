import { expect, test, type Page } from "@playwright/test";

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

test("G-01 language settings matches the wireframe constraints", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/language", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/language/);

  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByTestId("language-settings-form")).toBeVisible();
  await expect(
    page.getByTestId("language-ui-radio").locator('input[type="radio"]'),
  ).toHaveCount(3);
  await expect(page.getByTestId("language-learning-card")).toBeVisible();
  await expect(
    page.getByTestId("language-learning-radio").locator('input[type="radio"]'),
  ).toHaveCount(4);
  await expect(page.getByTestId("language-content-card")).toBeVisible();
  await expect(page.getByTestId("language-feedback-display")).toBeVisible();
  await expect(page.getByTestId("language-example-difficulty")).toBeVisible();
  await expect(page.getByTestId("language-explanation-length")).toBeVisible();
  await expect(page.getByTestId("language-help-item")).toHaveCount(3);
  await expect(page.getByTestId("language-unsupported-notice")).toBeVisible();
  await expect(page.getByTestId("language-save")).toBeDisabled();

  expect(errors).toEqual([]);
});
