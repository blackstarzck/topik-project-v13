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

test("learning settings keeps the target exam editor", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto("/settings/learning", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/learning/);

  await expect(page.getByRole("heading", { name: "학습 목표" })).toBeVisible();
  await expect(page.getByText("목표 시험")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "수정" }).or(
      page.getByRole("button", { name: "목표 설정하기" }),
    ),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
