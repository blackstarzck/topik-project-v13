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

test("D-M3 autosave warning modal blocks disabling autosave until confirmed", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);

  await page.getByRole("button", { name: "자동 저장 끄기" }).click();

  const modal = page.getByTestId("autosave-warning-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator(".ant-modal-mask")).toBeVisible();
  await expect(page.getByText("자동 저장을 끄시겠어요?")).toBeVisible();
  await expect(page.getByTestId("autosave-warning-body")).toContainText(
    "새로 고침이나 페이지 이동 시",
  );
  await expect(page.getByTestId("autosave-warning-state")).toBeVisible();
  await expect(page.getByTestId("autosave-warning-last-saved")).toBeVisible();
  await expect(page.getByTestId("autosave-warning-recovery-state")).toBeVisible();
  await expect(page.getByTestId("autosave-warning-retry")).toBeDisabled();
  await expect(page.getByTestId("autosave-warning-keep")).toBeEnabled();
  await expect(page.getByTestId("autosave-warning-proceed")).toBeEnabled();

  await page.getByTestId("autosave-warning-keep").click();
  await expect(modal).toBeHidden();

  expect(errors).toEqual([]);
});
