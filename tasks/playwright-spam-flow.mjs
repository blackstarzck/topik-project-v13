// Phase 8 — Navigate Daou Office to spam folder, open Supabase confirmation
// mail, extract verify URL, click it, capture redirect chain.

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
if (!mailFrame) { console.error("no mail-web frame"); process.exit(1); }

// Click ESC to close any context menu first
await mailPage.keyboard.press("Escape");
await mailPage.waitForTimeout(300);

// Click "스팸메일함" in sidebar
console.log("=== Clicking 스팸메일함...");
await mailFrame.locator('text=스팸메일함').first().click({ timeout: 5000 });
await mailPage.waitForTimeout(2000);
await mailPage.screenshot({ path: `${ROOT}/10-spam-folder.png`, fullPage: false });
console.log("Saved 10-spam-folder.png");

// Find supabase confirmation mail in spam list
// Subject is "Confirm your email address" (English template)
const subjectMatches = await mailFrame.$$eval('*', els => {
  const out = [];
  for (const el of els) {
    const t = (el.textContent || "").trim();
    if (t && t.length < 200 && (t.includes("Confirm your email") || t.includes("Confirm Your Email"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        out.push({ tag: el.tagName, text: t.substring(0, 100), x: r.x, y: r.y, w: r.width, h: r.height });
      }
    }
  }
  const seen = new Set();
  return out.filter(o => { if (seen.has(o.text)) return false; seen.add(o.text); return true; });
});
console.log("=== Confirm-mail rows found:", subjectMatches.length);
for (const m of subjectMatches) console.log("  ", m.text);

if (subjectMatches.length === 0) {
  console.log("FALLBACK: try Supabase발신자 text");
  const sup = await mailFrame.$$eval('*', els => {
    const out = [];
    for (const el of els) {
      const t = (el.textContent || "").trim();
      if (t === "Supabase" || t === "supabase") {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ text: t, x: r.x, y: r.y, w: r.width, h: r.height });
      }
    }
    return out;
  });
  console.log("  Supabase sender rows:", sup.length);
  subjectMatches.push(...sup);
}

if (subjectMatches.length === 0) {
  console.error("No confirmation mail found in spam. Maybe already deleted/expired.");
  await browser.close();
  process.exit(1);
}

// Double-click the first match to open mail body
const first = subjectMatches[0];
console.log("\n=== Double-clicking first match:", first.text);
await mailFrame.locator(`text="${first.text}"`).first().dblclick({ timeout: 5000 });
await mailPage.waitForTimeout(3000);
await mailPage.screenshot({ path: `${ROOT}/11-mail-opened.png`, fullPage: false });
console.log("Saved 11-mail-opened.png");

// Search supabase verify URL in all frames
console.log("\n=== Frames after open:");
for (const f of mailPage.frames()) console.log("  -", f.url() || "(blank)");

let verifyUrl = null;
for (const f of mailPage.frames()) {
  try {
    const hits = await f.$$eval('a', as =>
      as.map(a => a.href).filter(h => h && (h.includes("supabase.co/auth/v1/verify") || h.includes("fglggyfvzjdsbyckinqa")))
    );
    if (hits.length > 0) { verifyUrl = hits[0]; console.log("  → href found in frame:", f.url()); break; }
    const text = await f.locator("body").innerText({ timeout: 2000 }).catch(() => "");
    const m = text.match(/https?:\/\/[^\s<>"']*supabase[^\s<>"']*/);
    if (m) { verifyUrl = m[0]; console.log("  → URL in text in frame:", f.url()); break; }
  } catch (e) {}
}

console.log("\n=== Verify URL:", verifyUrl ? verifyUrl.substring(0, 280) : "NOT FOUND");

if (!verifyUrl) {
  await browser.close();
  process.exit(2);
}

// Navigate to verify URL in a new tab and capture redirect chain
const newTab = await ctx.newPage();
const navHistory = [];
newTab.on("framenavigated", f => { if (f === newTab.mainFrame()) navHistory.push(f.url()); });
console.log("\n=== Navigating verify URL in new tab...");
await newTab.goto(verifyUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(e => console.log("nav warn:", e.message));
await newTab.waitForTimeout(1500);

const finalUrl = newTab.url();
const finalTitle = await newTab.title();
const bodyText = await newTab.locator("body").innerText().catch(() => "");
console.log("\n=== FINAL URL:", finalUrl);
console.log("=== FINAL TITLE:", finalTitle);
console.log("\n=== Nav chain:");
for (const u of navHistory) console.log("  →", u.substring(0, 200));
console.log("\n=== Body text head:");
console.log(bodyText.substring(0, 500));

await newTab.screenshot({ path: `${ROOT}/12-after-callback.png`, fullPage: false });

writeFileSync(
  `${ROOT}/spam-click-result.json`,
  JSON.stringify({ verifyUrl, finalUrl, finalTitle, navHistory, bodyTextHead: bodyText.substring(0, 2000) }, null, 2),
  "utf-8"
);

await browser.close();
console.log("\nDONE. Artifacts in tasks/phase8-screenshots/");
