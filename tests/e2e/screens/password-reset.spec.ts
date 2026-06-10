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

test("X-06 password reset request renders and confirms intercepted send", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.route(/\/auth\/v1\/recover(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
      },
      body: "{}",
    });
  });

  await page.goto("/password-reset", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/password-reset/);

  await expect(
    page.getByRole("heading", { name: "비밀번호 재설정" }),
  ).toBeVisible();
  await expect(page.getByTestId("password-reset-security-visual")).toBeVisible();
  await expect(page.getByTestId("password-reset-request-card")).toBeVisible();
  await expect(page.getByTestId("password-reset-request-form")).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(
    page.getByText(/링크는 약 1시간 후 만료돼요/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "로그인으로 돌아가기" }),
  ).toHaveAttribute("href", "/login");

  await page.getByLabel("이메일").fill("reset.audit@example.com");
  await page.getByRole("button", { name: "재설정 링크 보내기" }).click();

  await expect(page.getByTestId("password-reset-sent-state")).toBeVisible();
  await expect(page.getByText("이메일을 확인하세요")).toBeVisible();
  await expect(page.getByText("reset.audit@example.com")).toBeVisible();
  await expect(page.getByTestId("password-reset-countdown")).toBeVisible();

  expect(errors).toEqual([]);
});
