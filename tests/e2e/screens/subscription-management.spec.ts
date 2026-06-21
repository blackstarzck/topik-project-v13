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

async function mockSubscriptionManagementData(page: Page) {
  await page.route("https://fglggyfvzjdsbyckinqa.supabase.co/rest/v1/**", async (route) => {
    const request = route.request();
    const url = request.url();
    const headers = {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    };

    if (request.method() === "HEAD") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    if (url.includes("/subscriptions")) {
      await route.fulfill({ status: 200, headers, body: "null" });
      return;
    }

    if (url.includes("/payment_history")) {
      await route.fulfill({
        status: 200,
        headers: { ...headers, "content-range": "0-0/0" },
        body: "[]",
      });
      return;
    }

    await route.fulfill({ status: 200, headers, body: "[]" });
  });
}

test("X-04 subscription management shows no-subscription shell without IA code", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await mockSubscriptionManagementData(page);

  await page.goto("/subscription", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/subscription/);

  await expect(page.getByTestId("subscription-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "구독 관리" })).toBeVisible();
  await expect(page.getByText("X-04")).toHaveCount(0);
  await expect(page.getByTestId("subscription-current-card")).toBeVisible();
  await expect(page.getByTestId("subscription-no-sub")).toBeVisible();
  await expect(page.getByTestId("subscription-start-cta")).toBeEnabled();
  await expect(page.getByTestId("subscription-change-card")).toHaveCount(0);
  await expect(page.getByTestId("subscription-history-card")).toBeVisible();
  await expect(page.getByText("결제 이력이 없습니다.")).toBeVisible();
  await expect(page.getByTestId("subscription-help-card")).toBeVisible();

  expect(errors).toEqual([]);
});
