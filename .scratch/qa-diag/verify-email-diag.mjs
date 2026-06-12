import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const allReqs = [];
const authReqs = [];
const consoleErrs = [];
let resendRouteHits = 0;

page.on("request", (r) => {
  const u = r.url();
  if (!u.startsWith(BASE)) allReqs.push(`${r.method()} ${u}`);
  if (u.includes("/auth/v1/")) authReqs.push(`${r.method()} ${u}`);
});
page.on("console", (m) => {
  if (m.type() === "error") consoleErrs.push(m.text());
});
page.on("pageerror", (e) => consoleErrs.push("pageerror: " + e.message));

// Mock the resend endpoint so no real email is sent; count hits.
await page.route(/\/auth\/v1\/resend(?:\?|$)/, async (route, request) => {
  if (request.method() === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      },
    });
    return;
  }
  resendRouteHits++;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: "{}",
  });
});

await page.addInitScript(() => {
  window.localStorage.removeItem("talkpik:verify-email:cooldown-until");
});

await page.goto(`${BASE}/auth/verify-email?email=verify.audit@gmail.com`, {
  waitUntil: "networkidle",
});

const hydrated = await page.evaluate(() => {
  const els = document.querySelectorAll("button, a, input");
  for (const el of els) {
    for (const k in el) {
      if (k.startsWith("__reactFiber$") || k.startsWith("__reactProps$")) return true;
    }
  }
  return false;
});

const resend = page.getByTestId("verify-email-resend");
const enabledBefore = await resend.isEnabled();
await resend.click();
await page.waitForTimeout(4500);

const stillLoading = await page.locator('[data-testid="verify-email-resend"].ant-btn-loading').count();
const cooldownVisible = await page.getByTestId("verify-email-countdown").isVisible().catch(() => false);
const inputDisabled = await page.locator("#verify-email-input").isDisabled().catch(() => false);

console.log("=== verify-email diagnostic ===");
console.log("BASE:", BASE);
console.log("hydrated (reactFiber present):", hydrated);
console.log("resend enabled before click:", enabledBefore);
console.log("resend route hits:", resendRouteHits);
console.log("auth/v1 requests:", JSON.stringify(authReqs, null, 2));
console.log("non-base requests:", JSON.stringify(allReqs.slice(0, 20), null, 2));
console.log("console errors:", JSON.stringify(consoleErrs, null, 2));
console.log("button still loading after 4.5s:", stillLoading);
console.log("cooldown visible:", cooldownVisible);
console.log("email input disabled:", inputDisabled);

await browser.close();
