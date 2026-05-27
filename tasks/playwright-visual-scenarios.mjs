// Phase 8 — Visual verification of scenarios 1, 2, 3, 5, 6 via Playwright

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const scenarios = [
  {
    n: 1,
    name: "otp_expired with email prefill",
    url: "http://localhost:3000/auth/error?reason=otp_expired&email=test@example.com",
    expect: {
      title: "인증 링크가 만료",
      primaryCta: "인증 메일 다시 받기",
      hasEmailInput: true,
      emailPrefillValue: "test@example.com",
    },
  },
  {
    n: 2,
    name: "user_not_found primary CTA = 다시 가입하기",
    url: "http://localhost:3000/auth/error?reason=user_not_found",
    expect: {
      title: "이 계정은 더 이상",
      primaryCta: "다시 가입하기",
      hasEmailInput: false,
    },
  },
  {
    n: 3,
    name: "rate-limit countdown 2분 0초",
    url: "http://localhost:3000/auth/error?reason=over_email_send_rate_limit&retry_after_seconds=120",
    expect: {
      title: "메일을 너무 많이",
      countdown: "2분",
      buttonDisabled: true,
    },
  },
  {
    n: 5,
    name: "verify-email post-signup landing",
    url: "http://localhost:3000/auth/verify-email?email=user@example.com",
    expect: {
      title: "이메일을 확인",
      hasResendButton: "인증 메일 다시 보내기",
      emailShown: "user@example.com",
    },
  },
  {
    n: 6,
    name: "login session_expired alert",
    url: "http://localhost:3000/login?reason=session_expired",
    expect: {
      hasAlert: "세션이 만료",
    },
  },
];

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const results = [];

for (const s of scenarios) {
  console.log(`\n=== Scenario ${s.n}: ${s.name}`);
  const tab = await ctx.newPage();
  await tab.goto(s.url, { waitUntil: "networkidle", timeout: 20000 });
  await tab.waitForTimeout(900);
  const body = await tab.locator("body").innerText().catch(() => "");
  const checks = {};

  if (s.expect.title) {
    checks.title = body.includes(s.expect.title) ? "✅" : `❌ (not found: ${s.expect.title})`;
  }
  if (s.expect.primaryCta) {
    const btn = await tab.locator(`button:has-text("${s.expect.primaryCta}")`).first().isVisible().catch(() => false);
    checks.primaryCta = btn ? "✅" : `❌ (button "${s.expect.primaryCta}" not visible)`;
  }
  if (s.expect.hasEmailInput !== undefined) {
    const input = await tab.locator('input[type="email"]').first().isVisible().catch(() => false);
    checks.hasEmailInput = (input === s.expect.hasEmailInput) ? "✅" : `❌ (visible=${input}, expected=${s.expect.hasEmailInput})`;
    if (s.expect.emailPrefillValue) {
      const val = await tab.locator('input[type="email"]').first().inputValue().catch(() => "");
      checks.emailPrefillValue = (val === s.expect.emailPrefillValue) ? "✅" : `❌ (got "${val}")`;
    }
  }
  if (s.expect.countdown) {
    checks.countdown = body.includes(s.expect.countdown) ? "✅" : `❌ (countdown text "${s.expect.countdown}" missing)`;
    // Verify the second decrements: snapshot now, wait 2s, snapshot
    const t0 = body.match(/(\d+분 ?\d+초|\d+초)/)?.[0] || "(no time)";
    await tab.waitForTimeout(2500);
    const body2 = await tab.locator("body").innerText().catch(() => "");
    const t1 = body2.match(/(\d+분 ?\d+초|\d+초)/)?.[0] || "(no time)";
    checks.countdownTick = (t0 !== t1) ? `✅ (${t0} → ${t1})` : `❌ (no tick: ${t0} → ${t1})`;
  }
  if (s.expect.buttonDisabled !== undefined) {
    const disabled = await tab.locator('button[data-testid="auth-error-primary"]').first().isDisabled().catch(() => false);
    checks.buttonDisabled = (disabled === s.expect.buttonDisabled) ? `✅ (disabled=${disabled})` : `❌ (got disabled=${disabled})`;
  }
  if (s.expect.hasResendButton) {
    const btn = await tab.locator(`button:has-text("${s.expect.hasResendButton}")`).first().isVisible().catch(() => false);
    checks.resendButton = btn ? "✅" : `❌`;
  }
  if (s.expect.emailShown) {
    checks.emailShown = body.includes(s.expect.emailShown) ? "✅" : `❌ (${s.expect.emailShown} not in body)`;
  }
  if (s.expect.hasAlert) {
    checks.alert = body.includes(s.expect.hasAlert) ? "✅" : `❌`;
  }

  for (const [k, v] of Object.entries(checks)) console.log(`  ${k.padEnd(20)} ${v}`);

  await tab.screenshot({ path: `${ROOT}/scenario-${s.n}.png`, fullPage: false });
  console.log(`  screenshot: scenario-${s.n}.png`);
  results.push({ n: s.n, name: s.name, url: s.url, checks });
  await tab.close();
}

writeFileSync(`${ROOT}/visual-results.json`, JSON.stringify(results, null, 2), "utf-8");
await browser.close();
console.log("\nDONE.");
