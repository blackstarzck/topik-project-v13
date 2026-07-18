import { defineConfig, devices } from "@playwright/test";
import { assertLoopbackRuntimeTarget } from "./scripts/lib/supabase-target-safety.mjs";

// 알림 오류 상태 전용 구성 — 이미 떠 있는 dev 서버를 E2E_BASE_URL로 지정한다
// (webServer 미기동, storageState 불필요 — 스펙이 직접 로그인).
// 기본 포트는 3100 (3000은 다른 체크아웃이 점유).
const BASE_URL = assertLoopbackRuntimeTarget(
  process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /notification-error-states\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [["list"]],
});
