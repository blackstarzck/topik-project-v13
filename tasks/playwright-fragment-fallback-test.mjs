// Phase 8.5 — Validate that the new fragment fallback maps Supabase
// implicit-flow expired-token responses to /auth/error?reason=otp_expired
// instead of the generic ?reason=unknown.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];

// Test 1: hit /auth/callback with a fragment that mimics expired implicit flow
const newTab = await ctx.newPage();
const navHistory = [];
newTab.on("framenavigated", f => { if (f === newTab.mainFrame()) navHistory.push(f.url()); });

const expiredFragmentUrl =
  "http://localhost:3000/auth/callback?next=/onboarding/learning-goal" +
  "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

console.log("=== Test 1: implicit flow expired fragment");
console.log("URL:", expiredFragmentUrl);
await newTab.goto(expiredFragmentUrl, { waitUntil: "networkidle", timeout: 30000 });
await newTab.waitForTimeout(2000);

const finalUrl = newTab.url();
const body = await newTab.locator("body").innerText().catch(() => "");
console.log("\nFINAL URL:", finalUrl);
console.log("BODY HEAD:", body.substring(0, 400).replace(/\s+/g, " "));
console.log("\nNav chain:");
for (const u of navHistory) console.log("  →", u);

const finalOk = finalUrl.includes("/auth/error") && finalUrl.includes("reason=otp_expired");
console.log("\n=== Test 1 result:", finalOk ? "✅ PASS (otp_expired correctly mapped)" : "❌ FAIL");

await newTab.screenshot({ path: `${ROOT}/40-fragment-fallback-expired.png`, fullPage: false });

// Test 2: hit /auth/callback with NO query NO fragment → unknown
const tab2 = await ctx.newPage();
await tab2.goto("http://localhost:3000/auth/callback?next=/onboarding/learning-goal", { waitUntil: "networkidle", timeout: 30000 });
await tab2.waitForTimeout(1500);
const finalUrl2 = tab2.url();
console.log("\n=== Test 2: no query no fragment → should be reason=unknown");
console.log("FINAL:", finalUrl2);
const ok2 = finalUrl2.includes("/auth/error") && finalUrl2.includes("reason=unknown");
console.log("Result:", ok2 ? "✅ PASS" : "❌ FAIL");
await tab2.screenshot({ path: `${ROOT}/41-fragment-fallback-empty.png`, fullPage: false });

writeFileSync(`${ROOT}/fragment-fallback-results.json`, JSON.stringify({
  test1: { url: expiredFragmentUrl, finalUrl, ok: finalOk, navHistory, bodyHead: body.substring(0, 500) },
  test2: { finalUrl: finalUrl2, ok: ok2 },
}, null, 2), "utf-8");

await browser.close();
console.log("\nDONE.");
