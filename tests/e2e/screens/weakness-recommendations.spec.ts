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

test("X-07 weakness recommendations renders without a billing gate", async ({
  page,
}) => {
  await page.route("**/rest/v1/user_notifications?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );

  const errors = collectErrors(page);

  await page.goto("/practice/weakness", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/practice\/weakness/);

  await expect(page.getByRole("heading", { name: "약점 보강" })).toBeVisible();
  await expect(
    page.getByText(
      "최근 글쓰기 결과를 바탕으로 보완이 필요한 영역과 추천 문제를 안내합니다.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "약점 분석" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "추천 문제" })).toBeVisible();
  await expect(page.getByText(/문법/).first()).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.locator('[data-testid^="weakness-rec-"]')).toHaveCount(4);
  await expect(page.getByTestId("diagnostic-empty")).toHaveCount(0);
  await expect(page.getByTestId("weakness-primary-start")).toBeVisible();
  await expect(page.getByTestId("weakness-locked-shell")).toHaveCount(0);
  await expect(page.getByText(/유료 플랜 전용/)).toHaveCount(0);
  await expect(page.getByText(/플랜 업그레이드/)).toHaveCount(0);

  expect(errors).toEqual([]);
});
