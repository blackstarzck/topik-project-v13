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

test("X-05 profile editing renders field constraints without dirtying data", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/profile", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/profile/);

  await expect(page.getByRole("heading", { name: "프로필" })).toBeVisible();

  const email = page.getByLabel("이메일");
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("readonly", "");

  await expect(page.getByLabel("이름")).toHaveAttribute("maxlength", "30");
  await expect(page.getByLabel("닉네임")).toHaveAttribute("maxlength", "20");
  await expect(page.getByLabel("자기소개")).toHaveAttribute("maxlength", "160");
  await expect(page.getByRole("button", { name: "프로필 저장" })).toBeDisabled();

  await expect(page.getByText("프로필 이미지")).toBeVisible();
  await expect(page.getByText(/JPG 또는 PNG, 5MB 이하/)).toBeVisible();
  await expect(page.getByLabel("이미지 업로드")).toBeEnabled();
  await expect(page.getByText("목표 시험")).toBeVisible();
  await expect(page.getByText("계정 상태")).toBeVisible();

  expect(errors).toEqual([]);
});
