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

test("learning settings shows the goal form directly (no card, no view step)", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/learning", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/learning/);

  // Page header stays.
  await expect(page.getByRole("heading", { name: "학습 목표" })).toBeVisible();

  // The edit form is the default view: TOPIK 등급 select + 목표 등급 input +
  // 저장 버튼이 바로 보인다.
  await expect(page.getByRole("combobox")).toBeVisible();
  await expect(page.getByLabel("목표 등급")).toBeVisible();
  const save = page.getByRole("button", { name: "저장" });
  await expect(save).toBeVisible();

  // 취소 버튼은 제거됐고, 옛 보기 단계(수정/목표 설정하기)도 없다.
  await expect(page.getByRole("button", { name: "취소" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "목표 설정하기" }),
  ).toHaveCount(0);

  // 변경값이 없으면 저장 비활성, 목표 등급을 바꾸면 활성화된다.
  await expect(save).toBeDisabled();
  const grade = page.getByLabel("목표 등급");
  const current = await grade.inputValue();
  await grade.fill(current === "5" ? "4" : "5");
  await grade.blur();
  await expect(save).toBeEnabled();

  expect(errors).toEqual([]);
});
