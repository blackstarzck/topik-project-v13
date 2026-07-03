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

// 빌링 deferred 동안 `/subscription`은 사이드바에서 숨겨져 있고, 검색창/딥링크로
// 직접 진입하면 동작하는 SubscriptionShell 대신 "준비중" 안내를 페이지 컨테이너
// 중앙에 표시한다. 라우트 자체는 살아 있으므로 로그인으로 리다이렉트되지 않는다.
test("X-04 subscription direct entry shows the centered coming-soon notice", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/subscription", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/subscription/);

  // 준비중 안내가 보이고, 기존 구독 관리 shell은 더 이상 렌더되지 않는다.
  // (antd Result의 title은 heading 요소가 아니라 .ant-result-title div라 텍스트로 확인)
  await expect(page.getByTestId("subscription-coming-soon")).toBeVisible();
  await expect(page.getByText("구독 기능을 준비하고 있어요")).toBeVisible();
  await expect(page.getByTestId("subscription-shell")).toHaveCount(0);
  await expect(page.getByText("X-04")).toHaveCount(0);

  // 대시보드로 이동 CTA가 노출된다.
  await expect(
    page.getByRole("link", { name: "대시보드로 이동" }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
