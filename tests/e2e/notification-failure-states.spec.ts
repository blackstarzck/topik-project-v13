import { expect, test, type Page } from "@playwright/test";

// QA N-SET-09/10, N-INB-09/11 — 네트워크 실패 강제 시나리오.
// 페이지 내 fetch 주입은 supabase-js가 생성 시점에 fetch를 캡처해 무효이므로
// (QA 3차 라운드 실증) Playwright route abort로만 강제할 수 있다.
// 실행: pnpm playwright test --config=playwright.notif.config.ts
// (E2E_BASE_URL로 실행 중인 dev 서버를 지정 — webServer 기동 없음)

const EMAIL = "ntf-user-optin@e2e-notification.test";
const PASSWORD = process.env.E2E_NTF_PASSWORD?.trim();
if (!PASSWORD) {
  throw new Error("E2E_NTF_PASSWORD must be set for notification e2e.");
}
const VERIFIED_PASSWORD: string = PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page
    .locator('input[type="email"], input#email, input:not([type="password"])')
    .first()
    .fill(EMAIL);
  await page.locator('input[type="password"]').fill(VERIFIED_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test.describe.serial("알림 실패 상태 (route abort)", () => {
  test("N-SET-09 설정 로드 실패 → 오류 Alert", async ({ page }) => {
    await login(page);
    await page.route("**/rest/v1/notification_settings**", (r) => r.abort());
    await page.goto("/settings/notifications");
    await expect(page.locator(".ant-alert").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("N-SET-10 저장 실패 → 오류 메시지 + 입력 보존", async ({ page }) => {
    await login(page);
    await page.goto("/settings/notifications");
    const sun = page.locator(".ant-tag-checkable", { hasText: "일" }).last();
    await expect(sun).toBeVisible({ timeout: 15_000 });
    const wasChecked = await sun.evaluate((el) =>
      el.classList.contains("ant-tag-checkable-checked"),
    );
    await sun.click(); // dirty
    await page.route("**/rest/v1/notification_settings**", (r) => r.abort());
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.locator(".ant-message-notice").first()).toBeVisible({
      timeout: 10_000,
    });
    // 입력 보존: 변경값 유지 + dirty 유지(저장 버튼 활성)
    const stillToggled = await sun.evaluate((el) =>
      el.classList.contains("ant-tag-checkable-checked"),
    );
    expect(stillToggled).toBe(!wasChecked);
    await expect(page.getByRole("button", { name: "저장" })).toBeEnabled();
    // 원상 복원 (재토글 → dirty 0 → 저장 불필요)
    await page.unroute("**/rest/v1/notification_settings**");
    await sun.click();
  });

  test("N-INB-09 수신함 로드 실패 → 오류 + 재시도 회복", async ({ page }) => {
    await login(page);
    // 목록 GET만 차단 (뱃지 count는 HEAD — 영향 없음)
    await page.route("**/rest/v1/user_notifications**", (r) =>
      r.request().method() === "GET" ? r.abort() : r.continue(),
    );
    await page.getByRole("button", { name: "알림 열기" }).click();
    await expect(page.locator(".app-notification-panel__error")).toBeVisible({
      timeout: 10_000,
    });
    const retry = page.getByRole("button", { name: "재시도" });
    await expect(retry).toBeVisible();
    await page.unroute("**/rest/v1/user_notifications**");
    await retry.click();
    await expect(page.locator(".app-notification-item").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("N-INB-11 읽음 처리 실패 → 낙관 롤백 + 오류", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "알림 열기" }).click();
    const unread = page
      .locator(".app-notification-item--unread .app-notification-item__button")
      .first();
    await expect(unread).toBeVisible({ timeout: 10_000 });
    await page.route("**/rest/v1/user_notifications**", (r) =>
      r.request().method() === "PATCH" ? r.abort() : r.continue(),
    );
    await unread.click();
    await expect(page.locator(".ant-message-notice").first()).toBeVisible({
      timeout: 10_000,
    });
    // 롤백: 수신함을 다시 열면 해당 항목이 여전히 미읽음
    await page.unroute("**/rest/v1/user_notifications**");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "알림 열기" }).click();
    await expect(
      page.locator(".app-notification-item--unread").first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
