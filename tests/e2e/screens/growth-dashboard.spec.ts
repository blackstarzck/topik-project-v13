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

test("X-02 growth dashboard is available without a paid-plan lock", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/growth", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/growth/);

  await expect(
    page.getByRole("heading", { name: "성장 대시보드" }),
  ).toBeVisible();
  await expect(page.getByTestId("growth-kpi-grid")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-average")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-attempts")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-improvement")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-goal")).toBeVisible();
  await expect(page.getByText("성장 추세 차트")).toBeVisible();
  await expect(page.getByText("약점 매트릭스")).toBeVisible();
  await expect(page.getByText("인사이트")).toBeVisible();
  await expect(page.getByText("최근 완료 문제")).toBeVisible();
  await expect(page.getByText("다음 추천 문제")).toBeVisible();
  await expect(page.getByTestId("growth-locked-report")).toHaveCount(0);
  await expect(page.getByText("유료 플랜 전용")).toHaveCount(0);

  expect(errors).toEqual([]);
});
