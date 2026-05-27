// Phase 8 우회 검증 성공 시연 — callback Route Handler 전환 후.
// 1. admin/generate_link 발급 hashed_token
// 2. Playwright로 /auth/callback?token_hash=...&type=email 직접 navigate
// 3. callback이 verifyOtp 통과 + Set-Cookie 헤더 emit
// 4. /onboarding/learning-goal로 redirect → 인증된 상태로 도착
// 5. 스크린샷 60-bypass-success-onboarding.png

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const hashedToken = readFileSync(
  resolve(process.cwd(), "tasks/codex-runs/hashed-token-6.txt"),
  "utf8",
).trim();

const SITE = "http://localhost:3000";
const url = `${SITE}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=email&next=/onboarding/learning-goal`;

console.log("navigate:", url);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const navHistory = [];
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) navHistory.push(frame.url());
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  // server redirect chain + onboarding page render 대기
  await page.waitForTimeout(3000);
} catch (e) {
  console.log("nav warn:", e.message);
}

const finalUrl = page.url();
const cookies = await ctx.cookies();
const sbCookie = cookies.find((c) => c.name.startsWith("sb-"));
const title = (await page.locator("h1, h2").first().textContent().catch(() => null)) || "";
const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";

try {
  await page.screenshot({
    path: resolve(ROOT, "60-bypass-success-onboarding.png"),
    fullPage: true,
    timeout: 10000,
  });
} catch (e) {
  console.log("screenshot warn:", e.message);
}

const result = {
  inputUrl: url,
  finalUrl,
  navHistory,
  title: title?.slice(0, 100),
  bodyHead: bodyText?.slice(0, 500),
  sbCookieReceived: !!sbCookie,
  sbCookieName: sbCookie?.name,
  reachedLearningGoal: finalUrl?.includes("/onboarding/learning-goal"),
  reachedAuthError: finalUrl?.includes("/auth/error"),
  reachedDashboard: finalUrl?.includes("/dashboard"),
  reachedLogin: finalUrl?.includes("/login"),
};

writeFileSync(
  resolve(ROOT, "bypass-success-result.json"),
  JSON.stringify(result, null, 2),
);

console.log("\n=== RESULT ===");
console.log(JSON.stringify(result, null, 2));

await ctx.close();
await browser.close();
