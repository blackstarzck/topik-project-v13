import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const STATE = "tests/e2e/auth-state/student.json";

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(`${BASE}/settings/notifications`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

const probe = await page.evaluate(() => {
  const inApp = document.querySelector('[data-testid="notification-channel-in_app"]');
  const email = document.querySelector('[data-testid="notification-channel-email"]');
  return {
    inAppTag: inApp ? inApp.tagName : "MISSING",
    inAppHasCheckbox: inApp ? !!inApp.querySelector('input[type="checkbox"]') : null,
    inAppAriaPressed: inApp ? inApp.getAttribute("aria-pressed") : null,
    emailTag: email ? email.tagName : "MISSING",
    emailDisabled: email ? email.disabled ?? email.getAttribute("disabled") : null,
    detailsToggle: !!document.querySelector('[data-testid="notification-details-toggle"]'),
    deferredText: document.body.textContent.includes("외부 발송은 준비가 끝난 뒤"),
    channelCardPresent: !!document.querySelector('[data-testid="notification-channel-card"]'),
  };
});
console.log("PROBE: " + JSON.stringify(probe));
console.log("ERRORS: " + JSON.stringify(errors));
await browser.close();
