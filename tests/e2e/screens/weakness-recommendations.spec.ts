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

test("X-07 weakness recommendations renders the free-plan locked branch", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/practice/weakness", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/practice\/weakness/);

  await expect(page.getByRole("heading", { name: "약점 보강" })).toBeVisible();
  await expect(page.getByTestId("weakness-locked-shell")).toBeVisible();
  await expect(page.getByTestId("weakness-locked-card")).toBeVisible();
  await expect(
    page.getByText("약점 기반 맞춤 추천은 유료 플랜 전용이에요"),
  ).toBeVisible();
  await expect(page.getByText(/현재 플랜:/)).toBeVisible();
  await expect(page.getByTestId("weakness-upgrade-plan")).toHaveAttribute(
    "href",
    "/paywall",
  );
  await expect(page.getByTestId("weakness-view-problems")).toHaveAttribute(
    "href",
    "/practice/problems",
  );

  expect(errors).toEqual([]);
});
