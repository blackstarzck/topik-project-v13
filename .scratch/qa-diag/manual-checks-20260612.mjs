// 1차 수정(first-qa-remediation) 검증용 수동 브라우저 확인 4건.
// prod 서버(127.0.0.1:3000)가 떠 있는 상태에서 실행:
//   node .scratch/qa-diag/manual-checks-20260612.mjs
// 비밀값은 .env.local에서 읽고 출력하지 않는다.
// 주의: e2e 풀 런 마지막의 logout spec이 storageState 토큰을 revoke하므로
// 여기서는 fresh login 세션 하나로 1~3을 검증하고, 같은 세션으로 마지막에
// G6 로그아웃을 검증한다(실사용자 시나리오와 동일).
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

const BASE = "http://127.0.0.1:3000";
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD ?? "";
const SHOT_DIR = ".scratch/qa-diag/manual-shots";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${detail}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// ---- 0) fresh login ----
await page.goto(`${BASE}/login`);
await page.locator('input[autocomplete="email"]').fill(EMAIL);
await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForURL("**/dashboard", { timeout: 15000 });

// ---- 1) D-3: malformed ?problem= id → 빈 상태 UI (에러 바운더리 아님) ----
{
  await page.goto(`${BASE}/writing/short-answer-writing-51?problem=${encodeURIComponent("잘못된id")}`, { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();
  const emptyState = body.includes("지문을 불러오지 못했어요");
  const errorBoundary = body.includes("문제가 발생했어요");
  await page.screenshot({ path: `${SHOT_DIR}/d3-malformed-problem-id.png` });
  record("D-3 malformed problem id", emptyState && !errorBoundary,
    `emptyState=${emptyState} errorBoundary=${errorBoundary}`);
}

// ---- 2) D-5: 루트 미매치 경로 → 커스텀 404 ----
{
  const resp = await page.goto(`${BASE}/이런-경로는-없습니다`, { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();
  const custom = body.includes("페이지를 찾을 수 없습니다");
  const nextDefault = body.includes("This page could not be found");
  await page.screenshot({ path: `${SHOT_DIR}/d5-root-404.png` });
  record("D-5 root custom 404", custom && !nextDefault && resp.status() === 404,
    `status=${resp.status()} custom=${custom} nextDefault=${nextDefault}`);
}

// ---- 3) X-09: 알림 토글 저장 영속성 (UNVERIFIED 해소) ----
{
  await page.goto(`${BASE}/settings/notifications`, { waitUntil: "networkidle" });
  const firstSwitch = page.getByTestId("notification-condition-card").locator("button[role='switch']").first();
  await firstSwitch.waitFor({ state: "visible", timeout: 10000 });
  const before = await firstSwitch.getAttribute("aria-checked");
  await firstSwitch.click();
  await page.getByTestId("notification-save").click();
  await page.getByText("알림 설정이 저장되었습니다.").waitFor({ timeout: 10000 });
  await page.reload({ waitUntil: "networkidle" });
  await firstSwitch.waitFor({ state: "visible", timeout: 10000 });
  const after = await firstSwitch.getAttribute("aria-checked");
  const flipped = before !== after;
  await page.screenshot({ path: `${SHOT_DIR}/x09-after-save-reload.png` });
  // 원상 복구
  await firstSwitch.click();
  await page.getByTestId("notification-save").click();
  await page.getByText("알림 설정이 저장되었습니다.").waitFor({ timeout: 10000 });
  await page.reload({ waitUntil: "networkidle" });
  await firstSwitch.waitFor({ state: "visible", timeout: 10000 });
  const restored = await firstSwitch.getAttribute("aria-checked");
  record("X-09 notification persistence", flipped && restored === before,
    `before=${before} afterSaveReload=${after} restored=${restored}`);
}

// ---- 4) G6: 로그아웃 → /login → 보호 라우트 차단 (토큰 revoke라 마지막 실행) ----
{
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOT_DIR}/g6-sidebar-before-logout.png` });
  await page.getByTestId("sidebar-logout").click();
  await page.waitForURL("**/login**", { timeout: 15000 });
  const atLogin = page.url().includes("/login");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL("**/login**", { timeout: 15000 });
  const blocked = page.url().includes("/login");
  await page.screenshot({ path: `${SHOT_DIR}/g6-after-logout-protected.png` });
  record("G6 logout + protected redirect", atLogin && blocked, `atLogin=${atLogin} protectedBlocked=${blocked}`);
}

await ctx.close();
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} manual checks passed`);
process.exit(failed.length ? 1 : 0);
