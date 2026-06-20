import { test, expect } from "@playwright/test";

// G6 (QA 2026-06-12): 프로필 화면 하단 로그아웃 진입점.
//
// ⚠️ 공유 storageState 세션으로 로그아웃하면 안 된다 — /auth/sign-out의
// signOut()이 학생 계정 토큰을 revoke해 같은 계정을 쓰는 잔여 테스트의
// 세션까지 깨뜨릴 수 있다. 그래서:
//   1) 자체 브라우저 컨텍스트에서 fresh login으로 시작하고 (auth.setup.ts 패턴),
//   2) 파일명을 workspace-…로 둬 screens/ 알파벳 정렬의 마지막에 오게 했다 —
//      desktop-1280이 마지막 프로젝트이므로 이 spec이 전체 스위트의 끝에서
//      실행되어, 전역 revoke가 일어나도 이후 영향 받을 테스트가 없다.
//      (파일명을 바꾸면 이 보장이 깨진다.)

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD ?? "";

test("account settings logout signs out and protects workspace routes (G6)", async ({ browser }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "logout flow runs once on desktop-1280",
  );
  expect(
    PASSWORD,
    "SUPABASE_TEST_PASSWORD must be set in .env.local for the logout flow",
  ).not.toBe("");

  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // Fresh login — 공유 storageState와 분리된 새 세션.
    await page.goto("/login");
    await page.locator('input[autocomplete="email"]').fill(EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    // 사이드바 하단에는 학습 문구와 로그아웃 진입점이 없어야 한다.
    await expect(page.getByTestId("sidebar-logout")).toHaveCount(0);
    await expect(
      page.getByText("매일 조금씩, 확실히 성장해요!"),
    ).toHaveCount(0);

    // 프로필 화면 하단 로그아웃 → form POST /auth/sign-out → 303 → /login.
    await page.goto("/settings/account", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/settings\/account/);
    const logoutButton = page.getByTestId("profile-logout");
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await page.waitForURL("**/login**", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);

    // 로그아웃 뒤 보호 라우트 재접근은 로그인으로 돌려보내야 한다.
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }
});
