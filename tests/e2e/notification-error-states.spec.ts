import { expect, test, type Page, type Route } from "@playwright/test";

// QA error-state verification — N-SET-09 / N-SET-10 / N-INB-09 / N-INB-11.
//
// WHY route interception (not in-page window.fetch override): supabase-js
// captures `fetch` at client-creation time, so overriding window.fetch from
// inside the page does not affect already-constructed clients. Playwright's
// page.route() intercepts at the network layer and is the only reliable way to
// force the Supabase REST failures these error UIs guard against.
//
// Run (server must already be up; pass its origin via E2E_BASE_URL):
//   pnpm playwright test --config=playwright.notif-error.config.ts
//
// Seeded fixture: ntf-user-optin@e2e-notification.test with one persistent
// UNREAD user_notifications row (template_key "e2e-error-state-persistent") and
// a notification_settings row. See tests/e2e/_tmp-seed-notif.mjs.

const EMAIL = "ntf-user-optin@e2e-notification.test";
const PASSWORD = process.env.E2E_NTF_PASSWORD ?? "Ntf-e2e-2026!seed";

// Supabase REST table endpoints (NEXT_PUBLIC_SUPABASE_URL/rest/v1/<table>).
const SETTINGS_ROUTE = "**/rest/v1/notification_settings**";
const INBOX_ROUTE = "**/rest/v1/user_notifications**";
const PROFILES_ROUTE = "**/rest/v1/profiles**";

// Realistic PostgREST 500 body so supabase-js populates `error.message`
// (an empty `{}` body yields an empty Error message → the message.error toast
// would render blank, which is a test artifact, not a product behaviour).
function fail500(route: Route) {
  return route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({
      code: "XX000",
      message: "강제 네트워크 오류 (e2e)",
      details: null,
      hint: null,
    }),
  });
}

async function login(page: Page) {
  await page.goto("/login");
  // Same locale-agnostic selectors auth.setup.ts relies on (antd Input attrs).
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

async function openBell(page: Page) {
  await page.getByRole("button", { name: "알림 열기" }).click();
}

test.describe.serial("알림 오류 상태 (route interception)", () => {
  // ── N-SET-09 ──────────────────────────────────────────────────────────
  // 알림 설정 로드 실패 → 오류 Alert + 화면 갇힘 없음(재시도 경로 = 재진입).
  test("N-SET-09 설정 로드 실패 → 오류 Alert, 화면 갇힘 없음", async ({
    page,
  }) => {
    await login(page);
    // Fail the settings SELECT (GET). Other methods pass through.
    await page.route(SETTINGS_ROUTE, (route: Route) =>
      route.request().method() === "GET" ? fail500(route) : route.continue(),
    );
    await page.goto("/settings/notifications");

    // 오류 Alert (settingsLoad.status === "error") — antd Alert role="alert".
    const errorAlert = page.locator(".ant-alert-error").first();
    await expect(errorAlert).toBeVisible({ timeout: 15_000 });
    await expect(errorAlert).toContainText("알림 설정을 불러오지 못했어요");

    // 화면 갇힘 없음: 페이지 셸/제목은 정상 렌더(빈 화면/크래시 아님).
    await expect(page.getByRole("button", { name: "알림 열기" })).toBeVisible();

    // 재시도 경로: route 해제 후 재진입하면 폼이 정상 로드된다.
    await page.unroute(SETTINGS_ROUTE);
    await page.goto("/settings/notifications");
    await expect(page.locator(".ant-alert-error")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("notification-save")).toBeVisible();
  });

  // ── N-SET-10 ──────────────────────────────────────────────────────────
  // 저장 직전 네트워크 차단 → 저장 → 오류 토스트 + 입력값 보존(재시도 가능).
  test("N-SET-10 저장 실패 → 오류 토스트 + 입력 보존, 재시도 가능", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/settings/notifications");

    // 폼 준비 대기: 저장 버튼이 보일 때까지(로딩 완료).
    const saveBtn = page.getByRole("button", { name: "저장" });
    await expect(saveBtn).toBeVisible({ timeout: 15_000 });

    // 입력값 변경(dirty 만들기): 첫 알림 조건 Switch 토글.
    const firstSwitch = page.locator(".ant-switch").first();
    await expect(firstSwitch).toBeVisible();
    const wasOn = await firstSwitch.evaluate((el) =>
      el.classList.contains("ant-switch-checked"),
    );
    await firstSwitch.click();
    const nowOn = await firstSwitch.evaluate((el) =>
      el.classList.contains("ant-switch-checked"),
    );
    expect(nowOn).toBe(!wasOn); // toggled
    await expect(saveBtn).toBeEnabled();

    // 저장 직전 네트워크 차단: prefs 저장(profiles.notification_prefs)도 막아
    // handleFinish가 반드시 throw → message.error 경로를 타게 한다.
    await page.route(PROFILES_ROUTE, (route: Route) => {
      const m = route.request().method();
      return m === "PATCH" || m === "POST" ? fail500(route) : route.continue();
    });
    await page.route(SETTINGS_ROUTE, (route: Route) =>
      route.request().method() === "GET" ? route.continue() : fail500(route),
    );

    await saveBtn.click();

    // 오류 토스트(message.error) — 에러 타입 notice, 문구는 실패/오류 안내.
    const toast = page.locator(".ant-message-notice-error").first();
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText(/실패|오류/);

    // 입력값 보존: 토글 상태 유지 + dirty 유지(저장 버튼 여전히 활성=재시도 가능).
    const stillToggled = await firstSwitch.evaluate((el) =>
      el.classList.contains("ant-switch-checked"),
    );
    expect(stillToggled).toBe(!wasOn);
    await expect(saveBtn).toBeEnabled();
  });

  // ── N-INB-09 ──────────────────────────────────────────────────────────
  // 인앱 수신함 로드 실패 → 오류 상태 + 재시도, 화면 갇힘 없음.
  test("N-INB-09 수신함 로드 실패 → 오류 + 재시도 회복", async ({ page }) => {
    await login(page);
    // 목록 GET만 차단(뱃지 count는 HEAD — 영향 없음).
    await page.route(INBOX_ROUTE, (route: Route) =>
      route.request().method() === "GET" ? fail500(route) : route.continue(),
    );
    await openBell(page);

    // 오류 상태 패널 + 오류 문구.
    const errorPanel = page.locator(".app-notification-panel__error");
    await expect(errorPanel).toBeVisible({ timeout: 10_000 });
    await expect(errorPanel).toContainText("알림을 불러오지 못했어요");

    // 재시도 버튼(텍스트 "다시 시도").
    const retry = page.getByRole("button", { name: "다시 시도" });
    await expect(retry).toBeVisible();

    // 화면 갇힘 없음 + 회복: route 해제 후 재시도하면 목록이 보인다.
    await page.unroute(INBOX_ROUTE);
    await retry.click();
    await expect(page.locator(".app-notification-item").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── N-INB-11 ──────────────────────────────────────────────────────────
  // 읽음 처리 직전 네트워크 차단 → 클릭 → 낙관적 UI 롤백 + 오류, 상태 불일치 잔존 금지.
  test("N-INB-11 읽음 처리 실패 → 낙관 롤백 + 오류, 불일치 잔존 없음", async ({
    page,
  }) => {
    await login(page);
    await openBell(page);

    const unreadItem = page.locator(".app-notification-item--unread").first();
    await expect(unreadItem).toBeVisible({ timeout: 10_000 });

    // 읽음 처리(PATCH)만 차단 — GET은 통과시켜 재로딩이 가능하게 둔다.
    await page.route(INBOX_ROUTE, (route: Route) =>
      route.request().method() === "PATCH" ? fail500(route) : route.continue(),
    );

    await unreadItem.locator(".app-notification-item__button").click();

    // 오류 토스트(message.error) — 에러 타입 notice, 문구는 실패/오류 안내.
    const toast = page.locator(".ant-message-notice-error").first();
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText(/실패|오류/);

    // 낙관 롤백: 클릭한 항목이 다시 미읽음으로 복원(잔존 항목 존재).
    await expect(
      page.locator(".app-notification-item--unread").first(),
    ).toBeVisible({ timeout: 10_000 });

    // 서버/화면 일치 검증: 서버에 읽음이 기록되지 않았음을 두 경로로 확인한다.
    // (1) 미읽음 뱃지 카운트가 유지된다(낙관 차감이 복원됨 → "1").
    await expect(page.locator(".ant-badge-count").first()).toContainText("1");

    // (2) route 해제 후 페이지를 새로고침하고 수신함을 다시 열면, 서버에서
    //     다시 불러온 목록에 해당 항목이 여전히 미읽음으로 남아 있다.
    await page.unroute(INBOX_ROUTE);
    await page.reload();
    await expect(page.getByRole("button", { name: "알림 열기" })).toBeVisible({
      timeout: 15_000,
    });
    await openBell(page);
    await expect(
      page.locator(".app-notification-item--unread").first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
