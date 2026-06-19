import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test("D-M1 submission confirmation modal renders without agreement gating", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/writing/short-answer-writing-51", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);

  await page.locator("textarea").first().fill("a".repeat(80));
  await page.locator("button.ant-btn-primary").first().click();

  const modal = page.getByTestId("submission-confirm-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".ant-checkbox-input")).toHaveCount(0);
  await expect(page.getByTestId("submission-confirm-submit")).toBeEnabled();

  await page.getByTestId("submission-confirm-cancel").click();
  await expect(modal).toBeHidden();
  expect(errors).toEqual([]);
});
