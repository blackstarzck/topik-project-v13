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

test("X-03 paywall hides IA code and keeps checkout deferred", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/paywall", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/paywall/);

  await expect(page.getByTestId("paywall-shell")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "구독 시작하기" }),
  ).toBeVisible();
  await expect(page.getByText("X-03")).toHaveCount(0);

  // The plan catalog (subscription_plans) is empty under the deferred billing
  // scope in docs/prd.md, so the
  // page may render either the plan grid or the "no plans" empty state. Both are
  // valid; anchor on whichever appears, then assert the state-specific details.
  const planGrid = page.getByTestId("paywall-plan-grid");
  const emptyState = page.getByTestId("paywall-empty-state");
  await expect(planGrid.or(emptyState)).toBeVisible({ timeout: 10_000 });

  if (await emptyState.isVisible()) {
    await expect(emptyState).toContainText("현재 안내 가능한 플랜이 없습니다.");
    await expect(planGrid).toHaveCount(0);
    // Checkout must stay unreachable when no plans are offered.
    await expect(page.locator('[data-testid^="paywall-select-"]')).toHaveCount(
      0,
    );
  } else {
    await expect(page.getByTestId("paywall-plan-monthly")).toBeVisible();
    await expect(page.getByTestId("paywall-plan-quarterly")).toBeVisible();
    await expect(page.getByTestId("paywall-plan-yearly")).toBeVisible();
    await expect(page.getByText("분기 10% 할인")).toBeVisible();
    await expect(page.getByText("분기 17% 할인")).toHaveCount(0);
    await expect(page.getByText("연간 17% 할인")).toBeVisible();
    await expect(page.getByTestId("paywall-stub-note").first()).toBeVisible();

    await page.getByTestId("paywall-select-quarterly").click();
    await expect(
      page.getByText("결제 연동은 준비 중입니다.", { exact: false }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/paywall/);
  }

  // Support/benefit panels render in both states.
  await expect(page.getByTestId("paywall-benefits-panel")).toBeVisible();
  await expect(page.getByTestId("paywall-payment-info")).toBeVisible();

  expect(errors).toEqual([]);
});
