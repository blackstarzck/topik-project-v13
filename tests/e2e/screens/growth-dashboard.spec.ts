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

test("X-02 growth dashboard shows basic KPI before the paid-report lock", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/growth", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/growth/);

  await expect(page.getByRole("heading", { name: "성장 대시보드" })).toBeVisible();
  await expect(page.getByTestId("growth-kpi-grid")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-average")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-attempts")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-improvement")).toBeVisible();
  await expect(page.getByTestId("growth-kpi-goal")).toBeVisible();
  await expect(page.getByTestId("growth-locked-report")).toBeVisible();
  await expect(page.getByTestId("growth-upgrade-cta")).toBeEnabled();
  await expect(page.getByTestId("growth-manage-cta")).toBeEnabled();
  await expect(page.getByText("성장 추세 차트")).toHaveCount(0);

  expect(errors).toEqual([]);
});
