// Phase 8 우회 검증 navigate 최종 — antd fix 후 시연.
// admin/generate_link 발급 hashed_token → /auth/callback PKCE path navigate →
// /onboarding/learning-goal 도착 시연 + 스크린샷.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const hashedToken = readFileSync(
  resolve(process.cwd(), "tasks/codex-runs/hashed-token-3.txt"),
  "utf8",
).trim();

const SITE = "http://localhost:3000";
const url = `${SITE}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=signup&next=/onboarding/learning-goal`;

console.log("navigate:", url);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const navHistory = [];
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) navHistory.push(frame.url());
});

let finalUrl, title, bodyHead, screenshotErr;

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  // server redirect chain이 끝날 시간 대기
  await page.waitForTimeout(2500);
  finalUrl = page.url();
  title = (await page.locator("h1, h2").first().textContent().catch(() => null)) || "";
  bodyHead = (await page.locator("body").innerText().catch(() => "")) || "";
} catch (e) {
  console.log("nav warn:", e.message);
  finalUrl = page.url();
}

try {
  await page.screenshot({
    path: resolve(ROOT, "60-bypass-final-navigate.png"),
    fullPage: true,
    timeout: 10000,
  });
} catch (e) {
  screenshotErr = e.message;
  console.log("screenshot warn:", screenshotErr);
}

const result = {
  inputUrl: url,
  finalUrl,
  navHistory,
  title: title?.slice(0, 100),
  bodyHead: bodyHead?.slice(0, 500),
  reachedLearningGoal: finalUrl?.includes("/onboarding/learning-goal"),
  reachedAuthError: finalUrl?.includes("/auth/error"),
  reachedDashboard: finalUrl?.includes("/dashboard"),
  reachedLogin: finalUrl?.includes("/login"),
  screenshotErr,
};

writeFileSync(
  resolve(ROOT, "bypass-final-result.json"),
  JSON.stringify(result, null, 2),
);

console.log("\n=== RESULT ===");
console.log(JSON.stringify(result, null, 2));

await ctx.close();
await browser.close();
