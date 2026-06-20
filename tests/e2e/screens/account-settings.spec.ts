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

test("account settings keeps login methods, account status, and logout", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/account", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/account/);

  await expect(page.getByRole("heading", { name: "계정 설정" })).toBeVisible();
  await expect(page.getByText("로그인 방법")).toBeVisible();
  await expect(page.getByText("이메일 로그인")).toBeVisible();
  await expect(page.getByText("Google 로그인")).toBeVisible();
  await expect(page.getByText("계정 상태")).toBeVisible();
  await expect(page.getByText("알림 설정")).toBeVisible();
  await expect(page.getByText("언어 설정")).toBeVisible();
  await expect(page.getByTestId("profile-logout")).toBeVisible();

  expect(errors).toEqual([]);
});
