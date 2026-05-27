// Phase 8 우회 검증 — 메일 한도 우회로 발급한 magic link URL을
// 브라우저에 직접 navigate해서 verifyOtp 통과 + 도착지 확인.
//
// 두 path 모두 시도:
//   A. PKCE server-side: /auth/callback?token_hash=...&type=signup&next=/onboarding/learning-goal
//   B. Implicit fallback: action_link 그대로 (Supabase /auth/v1/verify ... → redirect_to)
//
// 입력: tasks/codex-runs/hashed-token.txt, tasks/codex-runs/magic-link.txt

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

// PATH A 전용 (fresh token #2 — token #1은 timeout 시도에서 소비됐을 수 있음)
const hashedTokenA = readFileSync(
  resolve(process.cwd(), "tasks/codex-runs/hashed-token-2.txt"),
  "utf8",
).trim();
// PATH B 전용 (action_link, 원래 발급분 그대로)
const actionLink = readFileSync(
  resolve(process.cwd(), "tasks/codex-runs/magic-link.txt"),
  "utf8",
).trim();
const hashedToken = hashedTokenA;

const SITE = "http://localhost:3000";

const results = {};

const browser = await chromium.launch({ headless: true });

// ────────────────────────────────────────────────────────────────────
// PATH A: PKCE server-side
// callback이 verifyOtp({ token_hash, type: 'signup' })을 호출 →
//   성공 시 redirect(next) === redirect('/onboarding/learning-goal')
//   실패 시 /auth/error?reason=<mapped>
// ────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const navHistory = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navHistory.push(frame.url());
  });

  const url = `${SITE}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=signup&next=/onboarding/learning-goal`;
  console.log("[A] navigating:", url);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (e) {
    console.log("[A] nav warn:", e.message);
  }
  // 최종 URL 정착 대기
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const title = (await page.locator("h1, h2").first().textContent().catch(() => null)) || "";
  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";

  try {
    await page.screenshot({
      path: resolve(ROOT, "50-bypass-path-a-pkce.png"),
      fullPage: true,
      timeout: 10000,
    });
  } catch (e) {
    console.log("[A] screenshot warn:", e.message);
  }

  results.pathA_pkce = {
    inputUrl: url,
    finalUrl,
    navHistory,
    title: title.slice(0, 100),
    bodyHead: bodyText.slice(0, 400),
    reachedLearningGoal: finalUrl.includes("/onboarding/learning-goal"),
    reachedAuthError: finalUrl.includes("/auth/error"),
    reachedDashboard: finalUrl.includes("/dashboard"),
  };

  console.log("[A] final:", finalUrl);
  await ctx.close();
}

// ────────────────────────────────────────────────────────────────────
// PATH B: action_link 그대로 navigate
// Supabase /auth/v1/verify?token=...&type=signup&redirect_to=...
//   → 토큰 검증 후 redirect_to(로 설정된 우리 callback)으로 redirect
//
// 주: PATH A에서 token을 이미 verify했으면 B에서는 token이 invalid →
//     Supabase가 redirect_to에 error fragment 박아 보냄 →
//     우리 callback의 CallbackFragmentFallback이 /auth/error?reason=...로 처리.
// ────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const navHistory = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navHistory.push(frame.url());
  });

  console.log("[B] navigating action_link:", actionLink.slice(0, 80) + "...");

  try {
    await page.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (e) {
    console.log("[B] nav warn:", e.message);
  }
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  const title = (await page.locator("h1, h2").first().textContent().catch(() => null)) || "";
  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";

  try {
    await page.screenshot({
      path: resolve(ROOT, "51-bypass-path-b-actionlink.png"),
      fullPage: true,
      timeout: 10000,
    });
  } catch (e) {
    console.log("[B] screenshot warn:", e.message);
  }

  results.pathB_actionLink = {
    inputUrl: actionLink,
    finalUrl,
    navHistory,
    title: title.slice(0, 100),
    bodyHead: bodyText.slice(0, 400),
    reachedLearningGoal: finalUrl.includes("/onboarding/learning-goal"),
    reachedAuthError: finalUrl.includes("/auth/error"),
    reachedDashboard: finalUrl.includes("/dashboard"),
  };

  console.log("[B] final:", finalUrl);
  await ctx.close();
}

await browser.close();

writeFileSync(
  resolve(ROOT, "bypass-verify-results.json"),
  JSON.stringify(results, null, 2),
);

console.log("\n=== RESULTS ===");
console.log(JSON.stringify(results, null, 2));
