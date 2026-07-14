import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type Browser,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const NON_PROD_ENV_LABELS = new Set([
  "dev",
  "development",
  "local",
  "preview",
  "qa",
  "staging",
  "test",
  "testing",
]);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !text.startsWith("Failed to load resource:")) {
      errors.push(`console: ${text}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function fulfillRecover(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
    },
    body: "{}",
  });
}

function readRecoverRedirectTo(request: Request): string | null {
  const urlValue = new URL(request.url()).searchParams.get("redirect_to");
  if (urlValue) return urlValue;
  let payload:
    | { redirect_to?: unknown; redirectTo?: unknown }
    | undefined;
  try {
    payload = request.postDataJSON() as
      | { redirect_to?: unknown; redirectTo?: unknown }
      | undefined;
  } catch {
    return null;
  }
  const bodyValue = payload?.redirect_to ?? payload?.redirectTo;
  return typeof bodyValue === "string" ? bodyValue : null;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for account e2e");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicClient() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase public credentials for account e2e");
  }
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createInvitedUser(marker: string) {
  if (!PASSWORD) {
    throw new Error("Missing e2e password for account invite flow");
  }

  const email = `e2e-account-invite-${marker}@example.com`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: "E2E Account Invite",
      nationality_country_code: "KR",
      ui_locale: "ko",
      ui_locale_source: "manual",
    },
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Supabase did not return a temp user id.");
  return { email, userId };
}

async function waitForProfile(userId: string) {
  await expect
    .poll(async () => {
      const { data, error } = await serviceClient()
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.status ?? null;
    })
    .toBe("active");
}

async function waitForPasswordSignInReady(email: string) {
  if (!PASSWORD) {
    throw new Error("Missing e2e password for account invite flow");
  }

  let lastMessage = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await publicClient().auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (!error) {
      await publicClient().auth.signOut();
      return;
    }
    lastMessage = error.message;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Temp user password sign-in was not ready: ${lastMessage}`);
}

async function insertInstitutionInviteNotification(params: {
  affiliationCode: string;
  notificationId: string;
  userId: string;
}) {
  const { error } = await serviceClient().from("user_notifications").insert({
    id: params.notificationId,
    user_id: params.userId,
    template_key: "institution_invite",
    category: "notice",
    title: "기관 초대가 도착했어요",
    body: "초대를 확인하고 이 계정을 기관에 연결할지 선택하세요.",
    link_url: `/auth/institution-invite?aff=${params.affiliationCode}&next=/settings/account`,
    payload: {
      affiliation_code: params.affiliationCode,
      kind: "institution_invite",
    },
    read_at: null,
    created_at: new Date(Date.now() + 30_000).toISOString(),
  });
  if (error) throw error;
}

async function cleanupInviteFixture(userId: string | null) {
  if (!userId || !SERVICE_KEY || !SUPABASE_URL) return;
  if (!NON_PROD_ENV_LABELS.has(ENV_LABEL)) return;
  await serviceClient().auth.admin.deleteUser(userId);
}

async function loginTempUser(page: Page, email: string) {
  if (!PASSWORD) {
    throw new Error("Missing e2e password for account invite flow");
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[autocomplete="email"]');
  const passwordInput = page.locator('input[autocomplete="current-password"]');

  await emailInput.fill(email);
  await passwordInput.fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|auth\/consent|onboarding\/learning-goal)/, {
    timeout: 30_000,
  });

  for (let i = 0; i < 6; i += 1) {
    const pathname = new URL(page.url()).pathname;
    if (pathname === "/dashboard") {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      if (new URL(page.url()).pathname === "/dashboard") return;
      continue;
    }
    if (pathname === "/auth/consent") {
      await page.locator('input[name="accept"]').check({ force: true });
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/(dashboard|onboarding\/learning-goal)/, {
        timeout: 15_000,
      });
      continue;
    }
    if (pathname === "/onboarding/learning-goal") {
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL("**/dashboard", { timeout: 15_000 });
      return;
    }
    await page.waitForLoadState("networkidle");
  }

  await expect(page).toHaveURL(/\/dashboard/);
}

function viewportForProject(projectName: string) {
  return projectName === "mobile-360"
    ? { width: 360, height: 720 }
    : { width: 1280, height: 800 };
}

async function withFreshPage<T>(
  browser: Browser,
  projectName: string,
  run: (page: Page) => Promise<T>,
) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
    locale: "ko-KR",
    storageState: { cookies: [], origins: [] },
    viewport: viewportForProject(projectName),
  });
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await context.close();
  }
}

test("account settings keeps login methods, account status, and logout", async ({
  browser,
}, testInfo) => {
  test.skip(!PASSWORD, "Account settings e2e requires password credentials.");
  testInfo.setTimeout(60_000);

  await withFreshPage(browser, testInfo.project.name, async (page) => {
    await loginTempUser(page, EMAIL);

    const errors = collectErrors(page);
    const recoverRedirects: string[] = [];

    await page.route(/\/auth\/v1\/recover(?:\?|$)/, async (route, request) => {
      const redirectTo = readRecoverRedirectTo(request);
      if (redirectTo) recoverRedirects.push(redirectTo);
      await fulfillRecover(route);
    });

    await page.goto("/settings/account", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/settings\/account/);

    await expect(page.getByRole("heading", { name: "계정 설정" })).toBeVisible();
    // 재설계: 섹션 타이틀("로그인 방법"/"계정 상태")은 제거되고 카드·행만 남는다.
    const loginMethodsRegion = page.getByRole("region", {
      name: "로그인 방법",
    });
    await expect(
      loginMethodsRegion.getByText("계정 이메일", { exact: true }),
    ).toBeVisible();
    await expect(
      loginMethodsRegion.getByText("비밀번호 변경", { exact: true }),
    ).toBeVisible();
    await expect(
      loginMethodsRegion.getByText("Google 로그인", { exact: true }),
    ).toBeVisible();
    const emailTitle = loginMethodsRegion.getByText("계정 이메일", {
      exact: true,
    });
    const googleTitle = loginMethodsRegion.getByText("Google 로그인", {
      exact: true,
    });
    const logoutButton = page.getByRole("button", { name: "로그아웃" });
    const passwordChangeTitle = loginMethodsRegion.getByText("비밀번호 변경", {
      exact: true,
    });
    const deleteTitle = page.getByText("회원 탈퇴", { exact: true }).first();
    await expect(logoutButton).toBeVisible();
    await expect(deleteTitle).toBeVisible();
    const emailBox = await emailTitle.boundingBox();
    const googleBox = await googleTitle.boundingBox();
    const logoutBox = await logoutButton.boundingBox();
    const passwordBox = await passwordChangeTitle.boundingBox();
    const deleteBox = await deleteTitle.boundingBox();
    expect(emailBox).not.toBeNull();
    expect(googleBox).not.toBeNull();
    expect(logoutBox).not.toBeNull();
    expect(passwordBox).not.toBeNull();
    expect(deleteBox).not.toBeNull();
    expect(passwordBox!.y).toBeGreaterThan(emailBox!.y);
    expect(googleBox!.y).toBeGreaterThan(passwordBox!.y);
    expect(logoutBox!.y).toBeGreaterThan(googleBox!.y);
    expect(deleteBox!.y).toBeGreaterThan(logoutBox!.y);
    await page.evaluate(() => {
      window.localStorage.removeItem(
        "talkpik:settings-password-reset:cooldown-until",
      );
    });
    const passwordResetButton = page.getByTestId("account-password-reset-send");
    await expect(passwordResetButton).toHaveText("링크 보내기");
    await passwordResetButton.click();
    await expect.poll(() => recoverRedirects.length).toBe(1);
    const redirectUrl = new URL(recoverRedirects[0]);
    expect(redirectUrl.pathname).toBe("/auth/callback");
    expect(redirectUrl.searchParams.get("next")).toBe(
      "/password-reset/confirm",
    );
    await expect(
      page.locator(".ant-message-notice").getByText(
        "비밀번호 변경 링크를 보냈어요.",
      ),
    ).toBeVisible();
    await expect(passwordResetButton).toHaveText(/링크 보내기 \(\d+\)/);
    await expect(
      page
        .getByTestId("workspace-page-body")
        .getByText("비밀번호 변경 링크를 보냈어요."),
    ).toHaveCount(0);
    // 제거된 요소: 알림/언어 빠른 링크, 탈퇴/학습목표 안내 문구.
    await expect(page.getByText("알림 설정")).toHaveCount(0);
    await expect(page.getByText("언어 설정")).toHaveCount(0);
    await expect(
      page.getByText("회원 탈퇴는 다음 업데이트에서 지원됩니다."),
    ).toHaveCount(0);
    await expect(
      page.getByText("학습 목표는 프로필에 반영되어 추천·리포트에 사용됩니다."),
    ).toHaveCount(0);
    await expect(page.getByTestId("profile-logout")).toBeVisible();

    expect(errors).toEqual([]);
  });
});

// 회원 탈퇴 danger-zone. ⚠ 이 테스트는 절대 실제 제출하지 않는다 — 공유 E2E
// 학습자 계정을 소프트 삭제하면 storageState 를 재사용하는 다른 스펙이 인증
// 게이트(/auth/account-inactive)로 막혀 연쇄 실패한다. 모달 열기 →
// type-to-confirm 게이팅 확인 → 취소까지만 검증한다.
test("account settings exposes a guarded 회원 탈퇴 danger zone (no submit)", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("/settings/account", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/settings\/account/);

  const openButton = page.getByTestId("account-delete-open");
  await expect(openButton).toBeVisible();
  await openButton.click();

  const submit = page.getByTestId("account-delete-confirm-submit");
  await expect(submit).toBeVisible();
  // 키워드 입력 전에는 비활성.
  await expect(submit).toBeDisabled();

  const confirmInput = page.getByTestId("account-delete-confirm-input");
  await confirmInput.fill("틀린값");
  await expect(submit).toBeDisabled();

  // 정확한 키워드(ko: "삭제") 입력 시 활성화.
  await confirmInput.fill("삭제");
  await expect(submit).toBeEnabled();

  // 절대 submit 하지 않는다. 취소로 닫고 끝낸다.
  await page.getByRole("button", { name: "취소" }).click();
  await expect(submit).toBeHidden();

  // 여전히 설정 화면이며 세션이 유지된다(탈퇴되지 않음).
  await expect(page).toHaveURL(/\/settings\/account/);

  expect(errors).toEqual([]);
});

test("institution invite notification connects the account and appears in account settings", async ({
  browser,
}, testInfo) => {
  test.skip(
    !["desktop-1280", "mobile-360"].includes(testInfo.project.name),
    "Account invite notification e2e runs on desktop and mobile.",
  );
  test.skip(
    !SUPABASE_URL || !SERVICE_KEY || !PUBLISHABLE_KEY || !PASSWORD,
    "Institution invite notification e2e requires Supabase test credentials.",
  );
  test.skip(
    !NON_PROD_ENV_LABELS.has(ENV_LABEL),
    "Institution invite notification e2e must not create production data.",
  );
  test.setTimeout(120_000);

  const marker = randomUUID().slice(0, 8);
  const affiliationCode = `E2E_INVITE_${marker}`;
  const notificationId = randomUUID();
  let userId: string | null = null;

  try {
    const user = await createInvitedUser(marker);
    userId = user.userId;
    await waitForProfile(userId);
    await waitForPasswordSignInReady(user.email);
    await insertInstitutionInviteNotification({
      affiliationCode,
      notificationId,
      userId,
    });

    await withFreshPage(browser, testInfo.project.name, async (page) => {
      const errors = collectErrors(page);
      await loginTempUser(page, user.email);
      await page.goto("/dashboard", { waitUntil: "networkidle" });

      await page.getByRole("button", { name: "알림 열기" }).click();
      await page
        .locator(".app-notification-panel")
        .getByText("기관 초대가 도착했어요")
        .click();

      await expect(page).toHaveURL(/\/auth\/institution-invite/);
      await expect(page.getByText("기관 초대가 도착했어요").first()).toBeVisible();
      await expect(page.getByText(affiliationCode)).toBeVisible();

      await page.getByRole("checkbox", { name: "동의하시겠습니까?" }).check();
      await page.getByRole("button", { name: "기관에 연결" }).click();
      await expect(page.getByText("기관 연결이 완료됐어요")).toBeVisible();
      await page.getByRole("button", { name: "계속하기" }).click();

      await expect(page).toHaveURL(/\/settings\/account/);
      await expect(page.getByText("기관 소속")).toBeVisible();
      await expect(page.getByText(`기관 코드 ${affiliationCode}`)).toBeVisible();
      expect(errors).toEqual([]);
    });
  } finally {
    await cleanupInviteFixture(userId);
  }
});
