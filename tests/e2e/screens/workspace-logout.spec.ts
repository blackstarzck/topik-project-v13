import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertLocalPrivilegedMutationTarget } from "../../../scripts/lib/supabase-target-safety.mjs";

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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RECOVERY_DATABASE = "talkpik-client-recovery";
const RECOVERY_STORE = "writing-drafts";

async function getStudentUserId() {
  assertLocalPrivilegedMutationTarget(process.env);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Local logout recovery fixture is not configured.");
  }
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1_000,
  });
  if (error) throw new Error("Local logout recovery user lookup failed.");
  const user = data.users.find((candidate) => candidate.email === EMAIL);
  if (!user) throw new Error("Local logout recovery user is missing.");
  return user.id;
}

async function seedLogoutRecoveryRecords(page: Page, userId: string) {
  const savedAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.parse(savedAt) + 24 * 60 * 60 * 1_000,
  ).toISOString();
  const base = {
    answerJson: null,
    answerText: "local recovery boundary fixture",
    canonicalQuestionId: null,
    draftId: null,
    expiresAt,
    firstStoredAt: savedAt,
    importId: null,
    payloadHash: null,
    questionNo: 51,
    retention: "default",
    savedAt,
    schemaVersion: 1,
    userId,
  };
  await page.evaluate(
    async ({ base, databaseName, storeName }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "key" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readwrite");
          const store = transaction.objectStore(storeName);
          store.put({
            ...base,
            key: `${base.userId}:logout-synced:51`,
            problemId: "logout-synced",
            serverSyncedAt: base.savedAt,
          });
          store.put({
            ...base,
            key: `${base.userId}:logout-unsynced:51`,
            problemId: "logout-unsynced",
          });
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
    { base, databaseName: RECOVERY_DATABASE, storeName: RECOVERY_STORE },
  );
}

async function readRecoveryKeys(page: Page, userId: string) {
  return page.evaluate(
    async ({ databaseName, storeName, userId }) =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: "key" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          const getAll = database
            .transaction(storeName, "readonly")
            .objectStore(storeName)
            .getAll();
          getAll.onerror = () => reject(getAll.error);
          getAll.onsuccess = () => {
            database.close();
            resolve(
              getAll.result
                .filter(
                  (record) =>
                    typeof record === "object" &&
                    record !== null &&
                    (record as { userId?: unknown }).userId === userId,
                )
                .map((record) => (record as { key: string }).key)
                .sort(),
            );
          };
        };
      }),
    { databaseName: RECOVERY_DATABASE, storeName: RECOVERY_STORE, userId },
  );
}

test("account settings logout signs out and protects workspace routes (G6)", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "logout flow runs once on desktop-1280",
  );
  expect(
    PASSWORD,
    "SUPABASE_TEST_PASSWORD must be set in .env.local for the logout flow",
  ).not.toBe("");
  assertLocalPrivilegedMutationTarget(process.env);
  const userId = await getStudentUserId();

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
    await expect(page.getByText("매일 조금씩, 확실히 성장해요!")).toHaveCount(
      0,
    );

    // 프로필 화면 하단 로그아웃 → form POST /auth/sign-out → 303 → /login.
    await page.goto("/settings/account", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/settings\/account/);
    const recoveryOrigin = new URL(page.url()).origin;
    await seedLogoutRecoveryRecords(page, userId);
    await expect.poll(() => readRecoveryKeys(page, userId)).toHaveLength(2);
    const logoutButton = page.getByTestId("profile-logout");
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await page.waitForURL("**/login**", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
    const recoveryPage = await context.newPage();
    await recoveryPage.goto(`${recoveryOrigin}/login`);
    await expect
      .poll(() => readRecoveryKeys(recoveryPage, userId))
      .toEqual([`${userId}:logout-unsynced:51`]);
    await recoveryPage.close();

    // 로그아웃 뒤 보호 라우트 재접근은 로그인으로 돌려보내야 한다.
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }
});
