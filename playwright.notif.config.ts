import { defineConfig, devices } from "@playwright/test";
import { assertLoopbackRuntimeTarget } from "./scripts/lib/supabase-target-safety.mjs";

// 알림 실패 상태 전용 미니 구성 — 실행 중인 dev 서버를 E2E_BASE_URL로 지정해
// 사용한다 (webServer 기동 없음, storageState 불필요 — 스펙이 직접 로그인).
const BASE_URL = assertLoopbackRuntimeTarget(
  process.env.E2E_BASE_URL ?? "http://localhost:62719",
);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /notification-failure-states\.spec\.ts$/,
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
  },
  reporter: [["list"]],
});
