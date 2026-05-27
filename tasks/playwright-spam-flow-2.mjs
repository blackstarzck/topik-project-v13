// Phase 8 — Look for ALL Supabase confirmation mails in spam; collect every
// verify token; rewrite redirect_to to point at our /auth/callback (now in
// the Supabase whitelist); navigate and capture the real callback flow.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd(), "tasks/phase8-screenshots");
mkdirSync(ROOT, { recursive: true });

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const mailPage = ctx.pages().find(p => p.url().includes("keduall.daouoffice.com"));
await mailPage.bringToFront();
const mailFrame = mailPage.frames().find(f => f.url().includes("mail/web-index"));

// Make sure we're in 스팸메일함
await mailPage.keyboard.press("Escape");
await mailPage.waitForTimeout(300);
await mailFrame.locator('text=스팸메일함').first().click({ timeout: 5000 });
await mailPage.waitForTimeout(1500);

// Find every "Confirm your email address" subject row
const rows = await mailFrame.$$eval('*', els => {
  const out = [];
  for (const el of els) {
    const t = (el.textContent || "").trim();
    if (t && t.length < 200 && t.includes("Confirm your email")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ text: t.substring(0, 100), y: Math.round(r.y) });
    }
  }
  const seen = new Set();
  return out.filter(o => { if (seen.has(o.y)) return false; seen.add(o.y); return true; }).slice(0, 10);
});
console.log("Confirm mails in spam:", rows.length);

const allUrls = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  console.log(`\n--- Opening mail #${i+1} at y=${r.y} ---`);
  try {
    // Click row to focus, then open via 보기/dblclick
    const locator = mailFrame.locator(`text="${r.text.split("\n")[0]}"`).nth(0);
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 });
    await locator.dblclick({ timeout: 5000 });
    await mailPage.waitForTimeout(2500);
  } catch (e) {
    console.log("dblclick err:", e.message);
    continue;
  }

  // Search for supabase verify URL across all frames
  for (const f of mailPage.frames()) {
    try {
      const hits = await f.$$eval('a', as =>
        as.map(a => a.href).filter(h => h && h.includes("supabase.co/auth/v1/verify"))
      );
      if (hits.length > 0) {
        for (const h of hits) {
          if (!allUrls.includes(h)) allUrls.push(h);
          console.log("  URL:", h.substring(0, 200));
        }
        break;
      }
    } catch (e) {}
  }

  // Go back to spam list — click 스팸메일함 again
  await mailFrame.locator('text=스팸메일함').first().click({ timeout: 5000 }).catch(() => {});
  await mailPage.waitForTimeout(1500);
}

console.log("\n=== ALL extracted verify URLs:", allUrls.length);
for (const u of allUrls) console.log("  ", u.substring(0, 240));

// For each URL, rewrite redirect_to to our /auth/callback and try in new tab.
const targetRedirect = "http://127.0.0.1:3000/auth/callback?next=/onboarding/learning-goal";
const results = [];
for (let i = 0; i < allUrls.length; i++) {
  const raw = allUrls[i];
  const u = new URL(raw);
  u.searchParams.set("redirect_to", targetRedirect);
  const rewritten = u.toString();
  console.log(`\n--- Try #${i+1}: rewritten redirect_to ---`);
  console.log(rewritten.substring(0, 260));

  const newTab = await ctx.newPage();
  const nav = [];
  newTab.on("framenavigated", f => { if (f === newTab.mainFrame()) nav.push(f.url()); });
  try {
    await newTab.goto(rewritten, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) { console.log("nav warn:", e.message); }
  await newTab.waitForTimeout(1500);
  const finalUrl = newTab.url();
  const body = await newTab.locator("body").innerText().catch(() => "");
  console.log("FINAL:", finalUrl);
  console.log("BODY HEAD:", body.substring(0, 250).replace(/\s+/g, " "));
  await newTab.screenshot({ path: `${ROOT}/30-rewritten-try${i+1}.png`, fullPage: false });
  results.push({ rewritten, finalUrl, bodyHead: body.substring(0, 800), nav });
  await newTab.close();
}

writeFileSync(`${ROOT}/spam-batch-result.json`, JSON.stringify({ allUrls, results }, null, 2), "utf-8");
await browser.close();
console.log("\nDONE.");
