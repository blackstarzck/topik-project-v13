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

test("learning settings shows the goal form directly with dirty-gated save", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/learning", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/settings\/learning/);

  // Locale-agnostic assertions: the account's UI language is user-mutable
  // (/settings/language), so we assert by role/testid, not Korean copy.
  // Korean strings + 취소 제거 are covered by the unit test.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("combobox")).toBeVisible(); // TOPIK 등급 select
  const grade = page.getByRole("spinbutton"); // 목표 등급 input
  await expect(grade).toBeVisible();

  // The form CTA exposes only the save button (취소 제거됨).
  const save = page.getByTestId("exam-goal-save");
  await expect(save).toBeVisible();

  // dirty-gating: 변경값이 없으면 비활성, 목표 등급을 바꾸면 활성화된다.
  await expect(save).toBeDisabled();
  const current = await grade.inputValue();
  await grade.fill(current === "5" ? "4" : "5");
  await grade.blur();
  await expect(save).toBeEnabled();

  expect(errors).toEqual([]);
});
